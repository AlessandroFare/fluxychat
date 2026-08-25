/**
 * R7 JWT revocation — tests.
 *
 * Pins: revoke writes a self-expiring deny entry; verification consults it
 * only for tokens carrying a jti; KV failures fail OPEN (availability first,
 * documented ceiling); expired tokens need no revocation entry.
 */
import { describe, expect, it, vi } from "vitest";
import { revokeJti, isJtiRevoked, newJti } from "./token-revocation.js";

function makeKv() {
  const store = new Map();
  const ttls = new Map();
  return {
    store,
    ttls,
    get: async (k) => store.get(k) ?? null,
    put: async (k, v, opts = {}) => {
      store.set(k, v);
      ttls.set(k, opts.expirationTtl ?? null);
    },
  };
}

const NOW = Math.floor(Date.now() / 1000);

/** Mirrors worker.js signJwtHs256 (private there); enough for verifier tests. */
async function signJwtHs256(secret, payload) {
  const headerB64 = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const payloadB64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const data = `${headerB64}.${payloadB64}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${data}.${sigB64}`;
}

describe("token-revocation", () => {
  it("newJti returns unique UUIDs", () => {
    expect(newJti()).not.toBe(newJti());
    expect(newJti()).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("revokeJti writes a deny entry with TTL = remaining lifetime", async () => {
    const kv = makeKv();
    const res = await revokeJti({ RATE_LIMIT_KV: kv }, "abc", NOW + 3600);
    expect(res.ok).toBe(true);
    expect(kv.store.get("revoked:abc")).toBe("1");
    // 1h remaining; TTL clamps to at least 60 but equals ~3600 here.
    expect(kv.ttls.get("revoked:abc")).toBeGreaterThanOrEqual(3590);
    expect(kv.ttls.get("revoked:abc")).toBeLessThanOrEqual(3600);
  });

  it("TTL clamps to the KV minimum of 60s for near-expiry tokens", async () => {
    const kv = makeKv();
    await revokeJti({ RATE_LIMIT_KV: kv }, "shortlived", NOW + 5);
    expect(kv.ttls.get("revoked:shortlived")).toBe(60);
  });

  it("already-expired tokens skip the write entirely", async () => {
    const kv = makeKv();
    const res = await revokeJti({ RATE_LIMIT_KV: kv }, "dead", NOW - 100);
    expect(res).toEqual({ ok: true, alreadyExpired: true });
    expect(kv.store.size).toBe(0);
  });

  it("unparsable exp is a no-op success", async () => {
    const kv = makeKv();
    const res = await revokeJti({ RATE_LIMIT_KV: kv }, "weird", undefined);
    expect(res.alreadyExpired).toBe(true);
  });

  it("missing KV binding reports kv_unavailable instead of throwing", async () => {
    expect((await revokeJti({}, "x", NOW + 100)).reason).toBe("kv_unavailable");
    expect((await revokeJti({ RATE_LIMIT_KV: {} }, "x", NOW + 100)).reason).toBe(
      "kv_unavailable",
    );
  });

  it("isJtiRevoked true only for listed jtis", async () => {
    const kv = makeKv();
    await revokeJti({ RATE_LIMIT_KV: kv }, "bad", NOW + 600);
    expect(await isJtiRevoked({ RATE_LIMIT_KV: kv }, "bad")).toBe(true);
    expect(await isJtiRevoked({ RATE_LIMIT_KV: kv }, "good")).toBe(false);
  });

  it("KV read errors fail OPEN (documented ceiling)", async () => {
    const brokenKv = { get: async () => { throw new Error("kv down"); } };
    expect(await isJtiRevoked({ RATE_LIMIT_KV: brokenKv }, "anything")).toBe(false);
  });

  it("no jti / no binding always reads not-revoked (legacy tokens unaffected)", async () => {
    expect(await isJtiRevoked({}, "jti")).toBe(false);
    expect(await isJtiRevoked({ RATE_LIMIT_KV: makeKv() }, "")).toBe(false);
  });
});

describe("verifier integration — revoked token is rejected end-to-end", () => {
  /**
   * Drives verifyJwtAndGetContext with a real signed token and a fake project
   * secret row + KV, proving the check fires at the exact point in the verifier
   * where a stolen-but-valid signature must still be denied.
   */
  it("401 Token revoked after revocation, 200-context before", async () => {
        const secret = "test-secret-for-revocation";
    const jti = newJti();
    const expSec = Math.floor(Date.now() / 1000) + 1800;
    const token = await signJwtHs256(secret, {
      sub: "user_r7",
      tid: "proj_r7",
      roles: ["member"],
      jti,
      iat: NOW,
      exp: expSec,
    });

    const kv = makeKv();
    const env = {
      RATE_LIMIT_KV: kv,
      DB: {
        prepare(sql) {
          return {
            bind() {
              return {
                async first() {
                  if (sql.includes("FROM room_members")) return { role: "member" };
                  if (sql.includes("FROM project_secrets")) return { jwt_secret: secret };
                  return null;
                },
                async all() {
                  return { results: [] };
                },
              };
            },
          };
        },
      },
    };

    const req = new Request("https://w.test/messages?roomId=r1", {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Before revocation: valid.
    const before = await import("./jwt-auth.js").then((m) =>
      m.verifyJwtAndGetContext(req, env).catch((e) => ({ __thrown: e.status ?? String(e) })),
    );
    expect(before).toMatchObject({ userId: "user_r7", projectId: "proj_r7" });

    // Revoke.
    await revokeJti(env, jti, expSec);

    // After revocation: hard 401 with "Token revoked".
    const after = await import("./jwt-auth.js").then((m) =>
      m.verifyJwtAndGetContext(req, env).then(
        (ctx) => ({ __ok: ctx }),
        (e) => ({ __status: e.status, __text: e.statusText || "" }),
      ),
    );
    // The verifier throws a bare Response(…,{status:401}); text lives in body.
    expect(after.__status).toBe(401);
  });

  it("tokens without jti bypass the KV lookup entirely (legacy compatible)", async () => {
    const secret = "s2";
    const token = await signJwtHs256(secret, {
      sub: "u",
      tid: "p",
      roles: [],
      iat: NOW,
      exp: NOW + 300,
    });

    const kv = makeKv();
    const getSpy = vi.spyOn(kv, "get");
    const env = {
      RATE_LIMIT_KV: kv,
      DB: {
        prepare(sql) {
          return {
            bind() {
              return {
                async first() {
                  return sql.includes("project_secrets")
                    ? { jwt_secret: secret }
                    : null;
                },
                async all() {
                  return { results: [] };
                },
              };
            },
          };
        },
      },
    };

    const req = new Request("https://w.test/x", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const mod = await import("./jwt-auth.js");
    const ctx = await mod.verifyJwtAndGetContext(req, env);
    expect(ctx.userId).toBe("u");
    expect(getSpy).not.toHaveBeenCalled();
  });
});