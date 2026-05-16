import { describe, expect, it } from "vitest";
import {
  checkAndConsumeRateLimit,
  hasAnyRole,
  resolveCacheVersionKey,
  retryDelayMsForAttempt,
  truncateForStorage,
} from "./worker.js";
import {
  encryptWebhookSecret,
  isPlaintextWebhookSecretAllowed,
  isWebhookSecretEncryptionRequired,
  prepareWebhookSecretForStorage,
  resolveWebhookSigningSecret,
  signWebhookPayload,
  webhookRequiresSigningSecret,
} from "./lib/webhook-signing.js";
import { checkAndConsumeProjectQuota, monthKeyUtc } from "./lib/project-plan-quota.js";
import {
  verifyJwtAndGetContext,
  base64urlEncode,
} from "./lib/jwt-auth.js";

async function signJwtHs256Test(secret, payload) {
  const headerB64 = base64urlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payloadB64 = base64urlEncode(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${base64urlEncode(new Uint8Array(sig))}`;
}

describe("worker reliability helpers", () => {
  it("evaluates role membership correctly", () => {
    expect(hasAnyRole(["member"], ["owner", "admin"])).toBe(false);
    expect(hasAnyRole(["moderator"], ["owner", "moderator"])).toBe(true);
    expect(hasAnyRole([], ["owner"])).toBe(false);
  });

  it("uses expected retry backoff schedule", () => {
    expect(retryDelayMsForAttempt(1)).toBe(60_000);
    expect(retryDelayMsForAttempt(2)).toBe(300_000);
    expect(retryDelayMsForAttempt(3)).toBe(1_800_000);
    expect(retryDelayMsForAttempt(4)).toBe(3_600_000);
    expect(retryDelayMsForAttempt(99)).toBe(3_600_000);
  });

  it("truncates long errors for storage", () => {
    expect(truncateForStorage(null)).toBeNull();
    expect(truncateForStorage("abc", 10)).toBe("abc");
    expect(truncateForStorage("abcdefghijklmnopqrstuvwxyz", 10)).toBe(
      "abcdefghij..."
    );
  });

  it("denies when KV rate limit errors (no silent in-memory fallback)", async () => {
    const env = {
      RATE_LIMIT_KV: {
        async get() {
          throw new Error("kv unavailable");
        },
        async put() {
          throw new Error("kv unavailable");
        },
      },
      RATE_LIMIT_FALLBACK_ALLOW: "true",
    };
    const result = await checkAndConsumeRateLimit(env, {
      key: "kv-fail-test",
      limit: 10,
      windowSeconds: 60,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("kv_error");
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("applies in-memory rate limit fallback for local/dev", async () => {
    const env = { RATE_LIMIT_FALLBACK_ALLOW: "true" };
    const key = `test-rate-limit-${Date.now()}`;
    const limit = 2;
    const windowSeconds = 1;

    const first = await checkAndConsumeRateLimit(env, {
      key,
      limit,
      windowSeconds,
    });
    expect(first.allowed).toBe(true);

    const second = await checkAndConsumeRateLimit(env, {
      key,
      limit,
      windowSeconds,
    });
    expect(second.allowed).toBe(true);

    const third = await checkAndConsumeRateLimit(env, {
      key,
      limit,
      windowSeconds,
    });
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });
});

describe("monthKeyUtc", () => {
  it("returns UTC year-month", () => {
    expect(monthKeyUtc(new Date(Date.UTC(2026, 4, 3)))).toBe("2026-05");
  });
});

describe("webhook signing", () => {
  it("detects webhooks configured for signing", () => {
    expect(webhookRequiresSigningSecret({ secret_hash: "abc" })).toBe(true);
    expect(
      webhookRequiresSigningSecret({
        secret_ciphertext: "x",
        secret_iv: "y",
      })
    ).toBe(true);
    expect(webhookRequiresSigningSecret({ secret: "plain" })).toBe(true);
    expect(webhookRequiresSigningSecret({})).toBe(false);
  });

  it("signs deterministically", async () => {
    const a = await signWebhookPayload("secret", '{"x":1}');
    const b = await signWebhookPayload("secret", '{"x":1}');
    expect(a).toMatch(/^sha256=[a-f0-9]{64}$/);
    expect(a).toBe(b);
  });

  it("uses plaintext secret when no ciphertext is stored", async () => {
    const r = await resolveWebhookSigningSecret({}, {
      secret: " plain ",
      secret_ciphertext: null,
      secret_iv: null,
    });
    expect(r.fatalError).toBeNull();
    expect(r.secret).toBe("plain");
  });

  it("returns fatal error when ciphertext present but encryption key missing", async () => {
    const r = await resolveWebhookSigningSecret(
      {},
      {
        secret: "",
        secret_ciphertext: "aa",
        secret_iv: "bb",
      }
    );
    expect(r.secret).toBeNull();
    expect(r.fatalError).toBe("encryption_key_missing");
  });

  it("requires encryption key by default when storing a secret", async () => {
    const prep = await prepareWebhookSecretForStorage(
      {},
      "top-secret",
      async (s) => `hash:${s}`
    );
    expect(prep.ok).toBe(false);
    expect(prep.error).toBe("webhook_secret_encryption_required");
  });

  it("allows plaintext only when ALLOW_PLAINTEXT_WEBHOOK_SECRETS=true", async () => {
    expect(isWebhookSecretEncryptionRequired({ ALLOW_PLAINTEXT_WEBHOOK_SECRETS: "true" })).toBe(
      false
    );
    expect(isPlaintextWebhookSecretAllowed({ ALLOW_PLAINTEXT_WEBHOOK_SECRETS: "true" })).toBe(
      true
    );
    const prep = await prepareWebhookSecretForStorage(
      { ALLOW_PLAINTEXT_WEBHOOK_SECRETS: "true" },
      "dev-secret",
      async (s) => `hash:${s}`
    );
    expect(prep.ok).toBe(true);
    expect(prep.secretPlain).toBe("dev-secret");
    expect(prep.warning).toBe("webhook_secret_stored_plaintext");
  });

  it("round-trips encrypted webhook secrets when WEBHOOK_SECRET_ENCRYPTION_KEY is set", async () => {
    const rawKey = new Uint8Array(32);
    crypto.getRandomValues(rawKey);
    const WEBHOOK_SECRET_ENCRYPTION_KEY = Buffer.from(rawKey).toString("base64");
    const env = { WEBHOOK_SECRET_ENCRYPTION_KEY };
    const enc = await encryptWebhookSecret(env, "hunter2");
    expect(enc).not.toBeNull();
    const row = {
      secret: "",
      secret_ciphertext: enc.secretCiphertext,
      secret_iv: enc.secretIv,
    };
    const r = await resolveWebhookSigningSecret(env, row);
    expect(r.fatalError).toBeNull();
    expect(r.secret).toBe("hunter2");
  });
});

describe("checkAndConsumeProjectQuota", () => {
  it("atomically allows consumption until limit then denies", async () => {
    const limit = 3;
    const usageById = new Map();

    const planRow = {
      project_id: "p1",
      plan_name: "free",
      billing_status: "active",
      stripe_customer_id: null,
      stripe_subscription_id: null,
      message_limit_monthly: limit,
      agent_invoke_limit_monthly: 100,
      webhook_delivery_limit_monthly: 100,
      pricing_version: "v1",
      manually_overridden: 0,
      created_at: "x",
      updated_at: "x",
    };

    const env = {
      QUOTAS_ENABLED: "true",
      DB: {
        prepare(sql) {
          const q = sql.replace(/\s+/g, " ").trim();
          return {
            bind(...args) {
              return {
                async run() {
                  if (q.startsWith("INSERT OR IGNORE INTO project_usage_monthly")) {
                    const id = args[0];
                    if (!usageById.has(id)) usageById.set(id, 0);
                    return { meta: { changes: 1 } };
                  }
                  if (
                    q.startsWith(
                      "UPDATE project_usage_monthly SET used_value = used_value +"
                    )
                  ) {
                    const amount = args[0];
                    const id = args[2];
                    const max = args[4];
                    const cur = usageById.get(id) ?? 0;
                    if (cur + amount <= max) {
                      usageById.set(id, cur + amount);
                      return { meta: { changes: 1 } };
                    }
                    return { meta: { changes: 0 } };
                  }
                  return { meta: { changes: 0 } };
                },
                async first() {
                  if (q.includes("FROM project_plans WHERE project_id")) {
                    return planRow;
                  }
                  if (q.includes("FROM project_usage_monthly WHERE id")) {
                    const id = args[0];
                    return { used_value: usageById.get(id) ?? 0 };
                  }
                  return null;
                },
              };
            },
          };
        },
      },
    };

    const metric = "messages_created";
    const results = [];
    for (let i = 0; i < 4; i++) {
      results.push(
        await checkAndConsumeProjectQuota(env, {
          projectId: "p1",
          metricName: metric,
          amount: 1,
        })
      );
    }

    expect(results[0].allowed).toBe(true);
    expect(results[1].allowed).toBe(true);
    expect(results[2].allowed).toBe(true);
    expect(results[3].allowed).toBe(false);
    expect(results[3].limit).toBe(limit);
    expect(results[3].used).toBe(limit);
  });
});

describe("verifyJwtAndGetContext", () => {
  function mockProjectSecretsDb(row) {
    return {
      prepare() {
        return {
          bind() {
            return {
              async first() {
                return row;
              },
            };
          },
        };
      },
    };
  }

  it("returns context when HS256 matches stored secret", async () => {
    const secret = "test-secret-at-least-32-chars-long!!";
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = await signJwtHs256Test(secret, {
      sub: "user-1",
      tid: "proj-1",
      roles: ["member"],
      exp,
    });
    const env = { DB: mockProjectSecretsDb({ jwt_secret: secret }) };
    const req = new Request("https://example.test/", {
      headers: { Authorization: `Bearer ${token}` },
    });
    await expect(
      verifyJwtAndGetContext(req, env)
    ).resolves.toEqual({
      userId: "user-1",
      projectId: "proj-1",
      roles: ["member"],
    });
  });

  it("rejects with generic 401 when project has no stored secret (P1-2 timing)", async () => {
    const signingSecret = "any-valid-secret-for-hs256-test!";
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = await signJwtHs256Test(signingSecret, {
      sub: "user-1",
      tid: "unknown-project",
      roles: [],
      exp,
    });
    const env = { DB: mockProjectSecretsDb(null) };
    const req = new Request("https://example.test/", {
      headers: { Authorization: `Bearer ${token}` },
    });
    await expect(verifyJwtAndGetContext(req, env)).rejects.toMatchObject({
      status: 401,
    });
    try {
      await verifyJwtAndGetContext(req, env);
    } catch (e) {
      expect(e).toBeInstanceOf(Response);
      expect(await e.text()).toBe("Unauthorized");
    }
  });

  it("resolveCacheVersionKey shares project version for all rooms list cache keys", () => {
    expect(resolveCacheVersionKey("rooms:proj-1:alice:all")).toBe("ver:rooms:proj-1");
    expect(resolveCacheVersionKey("rooms:proj-1")).toBe("ver:rooms:proj-1");
    expect(resolveCacheVersionKey("stats:proj-1")).toBe("ver:stats:proj-1");
  });

  it("rejects with generic 401 when jwt_secret is empty string", async () => {
    const signingSecret = "another-valid-secret-for-hs256-test";
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = await signJwtHs256Test(signingSecret, {
      sub: "u",
      tid: "proj-empty",
      roles: [],
      exp,
    });
    const env = { DB: mockProjectSecretsDb({ jwt_secret: "" }) };
    const req = new Request("https://example.test/", {
      headers: { Authorization: `Bearer ${token}` },
    });
    await expect(verifyJwtAndGetContext(req, env)).rejects.toMatchObject({
      status: 401,
    });
  });
});
