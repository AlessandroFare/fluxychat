import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  ID_JAG_TOKEN_TYPE,
  ID_JAG_TYP,
  JWT_BEARER_GRANT,
  SUBJECT_ID_TOKEN,
  TOKEN_EXCHANGE_GRANT,
  enterpriseConfigMissing,
  exchangeForIdJag,
  fetchIdpJwks,
  redeemIdJag,
  verifyIdJag,
} from "./ops-mcp-enterprise.js";

const NOW = Date.UTC(2026, 9, 18, 12, 0, 0);
const ENV = { ALLOWED_SSRF_HOSTS: "idp.example.com, auth.example.com" };
const IDP_TOKEN = "https://idp.example.com/token";
const JWKS_URL = "https://idp.example.com/jwks";
const AS_TOKEN = "https://auth.example.com/token";
const VERIFY = {
  issuer: "https://idp.example.com",
  audience: "https://auth.example.com/",
  resource: "https://mcp.example.com/mcp",
  clientId: "as-client",
  now: NOW,
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function claims(overrides = {}) {
  return {
    iss: VERIFY.issuer,
    sub: "U123",
    aud: VERIFY.audience,
    client_id: VERIFY.clientId,
    jti: "jti-1",
    exp: Math.floor(NOW / 1000) + 300,
    iat: Math.floor(NOW / 1000) - 10,
    resource: VERIFY.resource,
    scope: "tools.read",
    ...overrides,
  };
}

async function signJag(payload, keys, { kid = keys.kid, typ = ID_JAG_TYP, alg = keys.jwk?.alg || "RS256" } = {}) {
  const data = `${encode({ typ, alg, kid })}.${encode(payload)}`;
  const algorithm =
    alg === "ES256"
      ? { name: "ECDSA", hash: "SHA-256" }
      : { name: "RSASSA-PKCS1-v1_5" };
  const signature = await crypto.subtle.sign(algorithm, keys.privateKey, new TextEncoder().encode(data));
  return `${data}.${Buffer.from(new Uint8Array(signature)).toString("base64url")}`;
}

let rsa;
let ec;

beforeAll(async () => {
  const rsaPair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  rsa = {
    privateKey: rsaPair.privateKey,
    kid: "k1",
    jwk: { ...(await crypto.subtle.exportKey("jwk", rsaPair.publicKey)), kid: "k1", alg: "RS256", use: "sig" },
  };
  const ecPair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  ec = {
    privateKey: ecPair.privateKey,
    kid: "e1",
    jwk: { ...(await crypto.subtle.exportKey("jwk", ecPair.publicKey)), kid: "e1", alg: "ES256", use: "sig" },
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("verifyIdJag", () => {
  it("accepts an RS256 ID-JAG signed by the configured IdP", async () => {
    const idJag = await signJag(claims(), rsa);
    const verified = await verifyIdJag(idJag, { ...VERIFY, jwks: { keys: [rsa.jwk] } });
    expect(verified.ok).toBe(true);
    expect(verified.claims).toMatchObject({
      iss: VERIFY.issuer,
      sub: "U123",
      client_id: "as-client",
      jti: "jti-1",
      resource: VERIFY.resource,
      scope: "tools.read",
    });
    // Only the known claims come back, not the raw JWT.
    expect(verified.claims).not.toHaveProperty("exp_raw");
  });

  it("accepts an ES256 ID-JAG", async () => {
    const verified = await verifyIdJag(await signJag(claims(), ec), { ...VERIFY, jwks: { keys: [ec.jwk] } });
    expect(verified.ok).toBe(true);
  });

  it("rejects a JWT that is not typed as an ID-JAG", async () => {
    const verified = await verifyIdJag(await signJag(claims(), rsa, { typ: "JWT" }), {
      ...VERIFY,
      jwks: { keys: [rsa.jwk] },
    });
    expect(verified).toMatchObject({ ok: false, error: "id_jag_invalid", reason: "typ" });
  });

  it("rejects symmetric or unknown algorithms", async () => {
    for (const alg of ["HS256", "none"]) {
      const verified = await verifyIdJag(await signJag(claims(), rsa, { alg }), {
        ...VERIFY,
        jwks: { keys: [rsa.jwk] },
      });
      expect(verified).toMatchObject({ ok: false, reason: "alg" });
    }
  });

  it("rejects a tampered payload and an unknown kid", async () => {
    const idJag = await signJag(claims(), rsa);
    const [header, , signature] = idJag.split(".");
    const tampered = `${header}.${encode(claims({ sub: "someone-else" }))}.${signature}`;
    expect(await verifyIdJag(tampered, { ...VERIFY, jwks: { keys: [rsa.jwk] } })).toMatchObject({
      ok: false,
      reason: "signature",
    });
    expect(await verifyIdJag(idJag, { ...VERIFY, jwks: { keys: [{ ...rsa.jwk, kid: "other" }] } })).toMatchObject({
      ok: false,
      reason: "signature",
    });
  });

  it("rejects the wrong issuer, audience, client, resource, jti, expiry and issue time", async () => {
    const cases = [
      [{ iss: "https://evil.example" }, "issuer"],
      [{ aud: "https://other.example/" }, "audience"],
      [{ client_id: "another-client" }, "client"],
      [{ resource: "https://mcp.example.com/other" }, "resource"],
      [{ jti: "" }, "jti"],
      [{ sub: "" }, "subject"],
      [{ exp: Math.floor(NOW / 1000) - 1 }, "expired"],
      [{ iat: Math.floor(NOW / 1000) + 3600 }, "iat"],
    ];
    for (const [override, reason] of cases) {
      const verified = await verifyIdJag(await signJag(claims(override), rsa), {
        ...VERIFY,
        jwks: { keys: [rsa.jwk] },
      });
      expect(verified, reason).toMatchObject({ ok: false, error: "id_jag_invalid", reason });
    }
  });

  it("accepts an aud array and a resource array that include the expected values", async () => {
    const verified = await verifyIdJag(
      await signJag(claims({ aud: ["https://auth.example.com/", "https://other.example/"], resource: ["https://mcp.example.com/mcp"] }), rsa),
      { ...VERIFY, jwks: { keys: [rsa.jwk] } },
    );
    expect(verified.ok).toBe(true);
  });
});

describe("exchangeForIdJag", () => {
  it("sends the RFC 8693 ID-JAG token-exchange profile", async () => {
    const seen = [];
    vi.stubGlobal("fetch", async (url, init) => {
      seen.push({ url: String(url), init });
      return json({
        issued_token_type: ID_JAG_TOKEN_TYPE,
        access_token: "jag-1",
        scope: "tools.read",
        expires_in: 300,
      });
    });
    const result = await exchangeForIdJag(ENV, {
      idpTokenUrl: IDP_TOKEN,
      audience: VERIFY.audience,
      resource: VERIFY.resource,
      scope: "tools.read",
      subjectToken: "id-token",
      subjectTokenType: SUBJECT_ID_TOKEN,
      clientId: "idp-client",
      clientSecret: "idp-secret",
    });
    expect(result).toMatchObject({ ok: true, idJag: "jag-1", scope: "tools.read" });
    expect(seen[0].url).toBe(IDP_TOKEN);
    const body = new URLSearchParams(seen[0].init.body);
    expect(body.get("grant_type")).toBe(TOKEN_EXCHANGE_GRANT);
    expect(body.get("requested_token_type")).toBe(ID_JAG_TOKEN_TYPE);
    expect(body.get("audience")).toBe(VERIFY.audience);
    expect(body.get("resource")).toBe(VERIFY.resource);
    expect(body.get("subject_token")).toBe("id-token");
    expect(body.get("subject_token_type")).toBe(SUBJECT_ID_TOKEN);
    expect(body.get("scope")).toBe("tools.read");
    expect(body.get("client_id")).toBe("idp-client");
    expect(body.get("client_secret")).toBe("idp-secret");
  });

  it("rejects a response that is not an ID-JAG, and surfaces IdP errors", async () => {
    vi.stubGlobal("fetch", async () => json({ issued_token_type: "urn:ietf:params:oauth:token-type:access_token", access_token: "at" }));
    expect(
      await exchangeForIdJag(ENV, {
        idpTokenUrl: IDP_TOKEN,
        audience: VERIFY.audience,
        resource: VERIFY.resource,
        subjectToken: "id-token",
        clientId: "idp-client",
      }),
    ).toMatchObject({ ok: false, error: "id_jag_exchange_failed" });

    vi.stubGlobal("fetch", async () => json({ error: "invalid_grant", error_description: "policy denied" }, 400));
    const denied = await exchangeForIdJag(ENV, {
      idpTokenUrl: IDP_TOKEN,
      audience: VERIFY.audience,
      resource: VERIFY.resource,
      subjectToken: "id-token",
      clientId: "idp-client",
    });
    expect(denied).toMatchObject({ ok: false, error: "id_jag_exchange_failed", status: 400 });
    expect(denied.message).toContain("policy denied");
  });
});

describe("redeemIdJag", () => {
  it("redeems the ID-JAG with the jwt-bearer grant", async () => {
    const seen = [];
    vi.stubGlobal("fetch", async (url, init) => {
      seen.push({ url: String(url), init });
      return json({ access_token: "as-at-1", token_type: "Bearer", expires_in: 3600, scope: "tools.read" });
    });
    const result = await redeemIdJag(ENV, {
      tokenUrl: AS_TOKEN,
      clientId: "as-client",
      clientSecret: "as-secret",
      idJag: "jag-1",
    });
    expect(result).toMatchObject({ ok: true, accessToken: "as-at-1", tokenType: "Bearer", expiresIn: 3600 });
    const body = new URLSearchParams(seen[0].init.body);
    expect(body.get("grant_type")).toBe(JWT_BEARER_GRANT);
    expect(body.get("assertion")).toBe("jag-1");
    expect(body.get("client_id")).toBe("as-client");
    expect(body.get("client_secret")).toBe("as-secret");
  });

  it("fails closed when the Resource AS rejects the assertion", async () => {
    vi.stubGlobal("fetch", async () => json({ error: "invalid_grant", error_description: "audience mismatch" }, 400));
    const result = await redeemIdJag(ENV, { tokenUrl: AS_TOKEN, clientId: "as-client", idJag: "jag-1" });
    expect(result).toMatchObject({ ok: false, error: "token_exchange_failed", status: 400 });
    expect(result.message).toContain("audience mismatch");
  });
});

describe("fetchIdpJwks", () => {
  it("returns the IdP keys and fails closed when they are unavailable", async () => {
    vi.stubGlobal("fetch", async () => json({ keys: [rsa.jwk] }));
    expect(await fetchIdpJwks(ENV, JWKS_URL)).toMatchObject({ ok: true, keys: [rsa.jwk] });

    vi.stubGlobal("fetch", async () => json({ error: "not_found" }, 404));
    expect(await fetchIdpJwks(ENV, JWKS_URL)).toMatchObject({ ok: false, error: "idp_jwks_unavailable" });
  });
});

describe("enterpriseConfigMissing", () => {
  it("names every missing enterprise field", () => {
    expect(enterpriseConfigMissing({})).toEqual([
      "oauthAuthorizeUrl",
      "oauthTokenUrl",
      "oauthClientId",
      "enterpriseIdpTokenUrl",
      "enterpriseIssuer",
      "enterpriseAudience",
      "enterpriseJwksUrl",
      "enterpriseResourceClientId",
    ]);
    expect(
      enterpriseConfigMissing({
        oauthAuthorizeUrl: "https://idp.example.com/authorize",
        oauthTokenUrl: AS_TOKEN,
        oauthClientId: "idp-client",
        enterpriseIdpTokenUrl: IDP_TOKEN,
        enterpriseIssuer: VERIFY.issuer,
        enterpriseAudience: VERIFY.audience,
        enterpriseJwksUrl: JWKS_URL,
        enterpriseResourceClientId: "as-client",
      }),
    ).toEqual([]);
  });
});
