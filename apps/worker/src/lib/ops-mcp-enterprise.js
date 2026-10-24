/**
 * C3: Enterprise-Managed Authorization (cross-app access / ID-JAG).
 *
 * The Worker is the MCP client. The connect flow signs the user in at the
 * enterprise IdP (authorization code + PKCE), exchanges the OIDC ID token (or
 * a refresh token, on renewal) for an Identity Assertion JWT Authorization
 * Grant at the IdP (RFC 8693 token exchange), validates the ID-JAG, and redeems
 * it at the Resource Authorization Server with the RFC 7523 jwt-bearer grant.
 *
 * The ID-JAG is validated before it is presented anywhere: typed header
 * (`typ: oauth-id-jag+jwt`), signature against the configured IdP JWKS,
 * and the claims the profile requires (iss, sub, aud, client_id, jti, exp,
 * iat, resource). Single use of the `jti` is enforced by the Resource AS; this
 * client mints a fresh ID-JAG for every exchange and never stores or replays
 * one.
 */
import { fetchJson } from "./ops-mcp-fetch.js";

export const ID_JAG_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:id-jag";
export const TOKEN_EXCHANGE_GRANT = "urn:ietf:params:oauth:grant-type:token-exchange";
export const JWT_BEARER_GRANT = "urn:ietf:params:oauth:grant-type:jwt-bearer";
export const SUBJECT_ID_TOKEN = "urn:ietf:params:oauth:token-type:id_token";
export const SUBJECT_REFRESH_TOKEN = "urn:ietf:params:oauth:token-type:refresh_token";
export const ID_JAG_TYP = "oauth-id-jag+jwt";

const CLOCK_SKEW_SECONDS = 60;
const MAX_MESSAGE_CHARS = 300;
const MAX_TOKEN_CHARS = 20000;
const MAX_SCOPE_CHARS = 1000;

/** Only asymmetric signatures: an HS* ID-JAG would share a secret with the IdP. */
const ALGORITHMS = {
  RS256: {
    kty: "RSA",
    importAlgo: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    verifyAlgo: { name: "RSASSA-PKCS1-v1_5" },
  },
  RS384: {
    kty: "RSA",
    importAlgo: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-384" },
    verifyAlgo: { name: "RSASSA-PKCS1-v1_5" },
  },
  RS512: {
    kty: "RSA",
    importAlgo: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-512" },
    verifyAlgo: { name: "RSASSA-PKCS1-v1_5" },
  },
  ES256: {
    kty: "EC",
    importAlgo: { name: "ECDSA", namedCurve: "P-256" },
    verifyAlgo: { name: "ECDSA", hash: "SHA-256" },
  },
  ES384: {
    kty: "EC",
    importAlgo: { name: "ECDSA", namedCurve: "P-384" },
    verifyAlgo: { name: "ECDSA", hash: "SHA-384" },
  },
};

/**
 * The EMA config a server needs before an enterprise connect can start.
 * `oauthAuthorizeUrl`/`oauthTokenUrl` keep their OAuth meaning: authorize at
 * the IdP, token at the Resource AS.
 */
export const ENTERPRISE_SERVER_FIELDS = [
  "oauthAuthorizeUrl",
  "oauthTokenUrl",
  "oauthClientId",
  "enterpriseIdpTokenUrl",
  "enterpriseIssuer",
  "enterpriseAudience",
  "enterpriseJwksUrl",
  "enterpriseResourceClientId",
];

export function enterpriseConfigMissing(server) {
  return ENTERPRISE_SERVER_FIELDS.filter((field) => !String(server?.[field] || "").trim());
}

function invalid(reason, message) {
  return { ok: false, error: "id_jag_invalid", reason, message };
}

function base64UrlBytes(value) {
  const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodePart(part) {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlBytes(part)));
  } catch {
    return null;
  }
}

function oauthError(fetched) {
  const payload = fetched.json || {};
  return String(payload.error_description || payload.error || fetched.error || `HTTP ${fetched.status}`).slice(
    0,
    MAX_MESSAGE_CHARS,
  );
}

/** Fetch the IdP's signing keys. Called once per exchange, right before validation. */
export async function fetchIdpJwks(env, jwksUrl) {
  const fetched = await fetchJson(jwksUrl, { method: "GET", headers: { accept: "application/json" } }, env);
  if (!fetched.ok || !Array.isArray(fetched.json?.keys)) {
    return { ok: false, error: "idp_jwks_unavailable", message: oauthError(fetched) };
  }
  return { ok: true, keys: fetched.json.keys };
}

/**
 * Verify an ID-JAG and return the claims the profile guarantees. `jwks` is the
 * parsed JWKS document; `resource` is the MCP server URL this Worker calls.
 */
export async function verifyIdJag(
  idJag,
  { jwks, issuer, audience, resource, clientId, now = Date.now() } = {},
) {
  const parts = String(idJag || "").split(".");
  if (parts.length !== 3) return invalid("malformed", "The ID-JAG is not a compact JWS.");
  const header = decodePart(parts[0]);
  const claims = decodePart(parts[1]);
  if (!header || !claims) return invalid("malformed", "The ID-JAG header or payload is not JSON.");
  if (header.typ !== ID_JAG_TYP) return invalid("typ", `Unexpected JWT typ ${String(header.typ || "none")}.`);
  const algorithm = ALGORITHMS[header.alg];
  if (!algorithm) return invalid("alg", `Unsupported ID-JAG algorithm ${String(header.alg || "none")}.`);

  const keys = Array.isArray(jwks?.keys) ? jwks.keys : [];
  const key = header.kid ? keys.find((item) => item.kid === header.kid) : keys.length === 1 ? keys[0] : null;
  if (!key || key.kty !== algorithm.kty) {
    return invalid("signature", "The IdP JWKS has no key for this ID-JAG.");
  }
  const imported = await crypto.subtle
    .importKey("jwk", key, algorithm.importAlgo, false, ["verify"])
    .catch(() => null);
  if (!imported) return invalid("signature", "The IdP signing key could not be imported.");
  const verifyAlgo = algorithm.verifyAlgo;
  const signedData = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signatureOk = await crypto.subtle.verify(verifyAlgo, imported, base64UrlBytes(parts[2]), signedData).catch(() => false);
  if (!signatureOk) return invalid("signature", "The ID-JAG signature does not verify.");

  if (typeof claims.iss !== "string" || claims.iss !== issuer) {
    return invalid("issuer", "The ID-JAG issuer is not the configured IdP.");
  }
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(audience)) {
    return invalid("audience", "The ID-JAG audience is not this Resource Authorization Server.");
  }
  if (typeof claims.sub !== "string" || !claims.sub) return invalid("subject", "The ID-JAG has no subject.");
  if (typeof claims.client_id !== "string" || claims.client_id !== clientId) {
    return invalid("client", "The ID-JAG was not issued for this client at the Resource Authorization Server.");
  }
  if (typeof claims.jti !== "string" || !claims.jti) return invalid("jti", "The ID-JAG has no jti.");
  const nowSeconds = Math.floor(now / 1000);
  if (typeof claims.exp !== "number" || claims.exp <= nowSeconds) {
    return invalid("expired", "The ID-JAG is expired.");
  }
  if (typeof claims.iat !== "number" || claims.iat > nowSeconds + CLOCK_SKEW_SECONDS) {
    return invalid("iat", "The ID-JAG was issued in the future.");
  }
  const resources = Array.isArray(claims.resource) ? claims.resource : [claims.resource];
  if (!resources.includes(resource)) {
    return invalid("resource", "The ID-JAG resource does not match this MCP server.");
  }

  return {
    ok: true,
    claims: {
      iss: claims.iss,
      sub: claims.sub,
      aud: claims.aud,
      client_id: claims.client_id,
      jti: claims.jti,
      exp: claims.exp,
      iat: claims.iat,
      resource: claims.resource,
      scope: typeof claims.scope === "string" ? claims.scope : null,
      email: typeof claims.email === "string" ? claims.email : null,
    },
  };
}

/**
 * Leg 1 — token exchange at the IdP. `subjectToken` is the OIDC ID token on
 * first connect, the IdP refresh token on renewal (when the IdP supports it).
 */
export async function exchangeForIdJag(
  env,
  {
    idpTokenUrl,
    audience,
    resource,
    scope,
    subjectToken,
    subjectTokenType = SUBJECT_ID_TOKEN,
    clientId,
    clientSecret,
  } = {},
) {
  if (!idpTokenUrl || !audience || !resource || !subjectToken || !clientId) {
    return { ok: false, error: "enterprise_config_incomplete" };
  }
  const body = new URLSearchParams({
    grant_type: TOKEN_EXCHANGE_GRANT,
    requested_token_type: ID_JAG_TOKEN_TYPE,
    audience: String(audience).slice(0, MAX_SCOPE_CHARS),
    resource,
    subject_token: String(subjectToken).slice(0, MAX_TOKEN_CHARS),
    subject_token_type: subjectTokenType,
    client_id: clientId,
  });
  if (scope) body.set("scope", String(scope).slice(0, MAX_SCOPE_CHARS));
  if (clientSecret) body.set("client_secret", clientSecret);
  const fetched = await fetchJson(
    idpTokenUrl,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: body.toString(),
    },
    env,
  );
  const payload = fetched.json || {};
  if (!fetched.ok) {
    return { ok: false, error: "id_jag_exchange_failed", status: fetched.status || 0, message: oauthError(fetched) };
  }
  if (payload.issued_token_type !== ID_JAG_TOKEN_TYPE) {
    return {
      ok: false,
      error: "id_jag_exchange_failed",
      message: `The IdP returned ${String(payload.issued_token_type || "no token type")} instead of an ID-JAG.`,
    };
  }
  const idJag = String(payload.access_token || "");
  if (!idJag) return { ok: false, error: "id_jag_exchange_failed", message: "The IdP returned no ID-JAG." };
  return {
    ok: true,
    idJag,
    scope: typeof payload.scope === "string" ? payload.scope : null,
    refreshToken: typeof payload.refresh_token === "string" && payload.refresh_token ? payload.refresh_token : null,
  };
}

/** Leg 2 — redeem the ID-JAG at the Resource Authorization Server (RFC 7523). */
export async function redeemIdJag(env, { tokenUrl, clientId, clientSecret, idJag } = {}) {
  if (!tokenUrl || !clientId || !idJag) return { ok: false, error: "enterprise_config_incomplete" };
  const body = new URLSearchParams({
    grant_type: JWT_BEARER_GRANT,
    assertion: String(idJag).slice(0, MAX_TOKEN_CHARS),
    client_id: clientId,
  });
  if (clientSecret) body.set("client_secret", clientSecret);
  const fetched = await fetchJson(
    tokenUrl,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: body.toString(),
    },
    env,
  );
  const payload = fetched.json || {};
  const accessToken = String(payload.access_token || "");
  if (!fetched.ok || !accessToken) {
    return {
      ok: false,
      error: "token_exchange_failed",
      status: fetched.status || 0,
      message: oauthError(fetched),
    };
  }
  return {
    ok: true,
    accessToken,
    expiresIn: payload.expires_in,
    scope: typeof payload.scope === "string" ? payload.scope : null,
    tokenType: typeof payload.token_type === "string" ? payload.token_type : null,
  };
}
