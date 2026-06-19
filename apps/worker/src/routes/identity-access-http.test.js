import { afterEach, describe, expect, it, vi } from "vitest";
import { dispatchIdentityRoutes } from "./identity-access-http.js";

const TEST_JWT_SECRET = "test-jwt-secret-for-identity-access";

function b64url(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeJwtPayload(payload) {
  return btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Audit CRITICAL #2: verifyAdmin now verifies the HMAC signature, so tests
// must mint a properly-signed HS256 token (the old ".sig" forgery is exactly
// what the fix rejects).
async function adminJwt(overrides = {}) {
  const payload = {
    sub: "user_admin",
    tid: "proj_1",
    roles: ["admin"],
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
  const header = encodeJwtPayload({ alg: "HS256", typ: "JWT" });
  const body = encodeJwtPayload(payload);
  const data = `${header}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(TEST_JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return `${data}.${b64url(new Uint8Array(sig))}`;
}

function buildDb(overrides = {}) {
  const samlConfig = overrides.samlConfig ?? null;
  return {
    prepare(sql) {
      return {
        bind() {
          return {
            first: async () => {
              if (sql.includes("project_secrets")) {
                return { jwt_secret: TEST_JWT_SECRET };
              }
              if (sql.includes("FROM saml_configurations") && sql.includes("project_id")) {
                return samlConfig;
              }
              return null;
            },
            all: async () => ({ results: [] }),
            run: async () => ({ meta: { changes: 1 } }),
          };
        },
      };
    },
  };
}

describe("dispatchIdentityRoutes  SAML", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null for unrelated paths", async () => {
    const req = new Request("http://127.0.0.1:8787/rooms", { method: "GET" });
    const res = await dispatchIdentityRoutes(req, new URL(req.url), { env: { DB: buildDb() } });
    expect(res).toBeNull();
  });

  it("GET /saml/config returns 401 without bearer token", async () => {
    const req = new Request("http://127.0.0.1:8787/saml/config", { method: "GET" });
    const res = await dispatchIdentityRoutes(req, new URL(req.url), { env: { DB: buildDb() } });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("unauthorized");
  });

  it("GET /saml/config returns 403 for member role", async () => {
    const req = new Request("http://127.0.0.1:8787/saml/config", {
      method: "GET",
      headers: { Authorization: `Bearer ${await adminJwt({ roles: ["member"] })}` },
    });
    const res = await dispatchIdentityRoutes(req, new URL(req.url), { env: { DB: buildDb() } });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("forbidden");
  });

  it("GET /saml/config returns configured:false when no row", async () => {
    const req = new Request("http://127.0.0.1:8787/saml/config", {
      method: "GET",
      headers: { Authorization: `Bearer ${await adminJwt()}` },
    });
    const res = await dispatchIdentityRoutes(req, new URL(req.url), {
      env: { DB: buildDb({ samlConfig: null }) },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configured).toBe(false);
  });

  it("GET /saml/config returns config summary when configured", async () => {
    const req = new Request("http://127.0.0.1:8787/saml/config", {
      method: "GET",
      headers: { Authorization: `Bearer ${await adminJwt()}` },
    });
    const res = await dispatchIdentityRoutes(req, new URL(req.url), {
      env: {
        DB: buildDb({
          samlConfig: {
            status: "active",
            idp_entity_id: "https://idp.example",
            idp_sso_url: "https://idp.example/sso",
            sp_entity_id: "fluxychat-sp",
            sp_acs_url: "https://api.example/saml/acs",
            name_id_format: "email",
            attribute_mapping: "{}",
          },
        }),
      },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configured).toBe(true);
    expect(body.idp_entity_id).toBe("https://idp.example");
    expect(body.enabled).toBe(true);
  });

  it("POST /saml/acs returns 400 without SAMLResponse", async () => {
    const req = new Request("http://127.0.0.1:8787/saml/acs", {
      method: "POST",
      body: new URLSearchParams({}),
    });
    const res = await dispatchIdentityRoutes(req, new URL(req.url), { env: { DB: buildDb() } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Missing SAMLResponse");
  });
});
