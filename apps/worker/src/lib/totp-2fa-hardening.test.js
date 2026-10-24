import { describe, expect, it } from "vitest";
import { generateBackupCodes, verifyAdminTotp } from "./totp-2fa.js";

function mockEnv({ secret = null, backupRow = null, rateLimit = null } = {}) {
  const runs = [];
  let lastUsedStep = null;
  return {
    runs,
    env: {
      RATE_LIMIT_FALLBACK_ALLOW: "true",
      ...(rateLimit ? { RATE_LIMIT_TOTP_VERIFY_PER_MINUTE: String(rateLimit) } : {}),
      DB: {
        prepare(sql) {
          const text = String(sql);
          return {
            bind(...args) {
              return {
                async first() {
                  if (text.includes("FROM admin_totp_secrets")) {
                    return secret ? { id: "s1", secret, enabled: 1, last_used_step: lastUsedStep } : null;
                  }
                  if (text.includes("FROM admin_totp_backup_codes")) {
                    const codeHash = args[2];
                    return backupRow && backupRow.code_hash === codeHash ? backupRow : null;
                  }
                  return null;
                },
                async run() {
                  runs.push({ text, args });
                  if (text.includes("last_used_step")) {
                    // Audit F-32: model the atomic single-use claim.
                    const step = args[0];
                    if (lastUsedStep === null || step > lastUsedStep) {
                      lastUsedStep = step;
                      return { meta: { changes: 1 } };
                    }
                    return { meta: { changes: 0 } };
                  }
                  return { meta: { changes: 1 } };
                },
              };
            },
          };
        },
      },
    },
  };
}

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(str) {
  let bits = "";
  for (const c of String(str).toUpperCase()) {
    const val = B32.indexOf(c);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }
  return bytes;
}

/** Independent TOTP implementation (RFC 6238) used to build the test code. */
async function currentTotp(secret) {
  const counter = new ArrayBuffer(8);
  new DataView(counter).setUint32(4, Math.floor(Date.now() / 1000 / 30), false);
  const key = await crypto.subtle.importKey(
    "raw",
    base32Decode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const hash = new Uint8Array(await crypto.subtle.sign("HMAC", key, counter));
  const offset = hash[hash.length - 1] & 0x0f;
  const otp =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);
  return String(otp % 1_000_000).padStart(6, "0");
}

describe("verifyAdminTotp hardening (#24)", () => {
  it("accepts a generated backup code exactly once (hash matches canonical form)", async () => {
    const { codes, codeHashes } = await generateBackupCodes();
    const { env, runs } = mockEnv({
      secret: "JBSWY3DPEHPK3PXP",
      backupRow: { id: "b1", code_hash: codeHashes[0] },
    });
    const result = await verifyAdminTotp(env, "p1", "u1", codes[0]);
    expect(result).toMatchObject({ verified: true, method: "backup" });
    expect(runs.some((r) => r.text.includes("used_at"))).toBe(true);
  });

  it("rate limits repeated failed attempts", async () => {
    const { env } = mockEnv({ secret: "JBSWY3DPEHPK3PXP", rateLimit: 1 });
    const first = await verifyAdminTotp(env, "p1", "rl-user", "000000");
    expect(first.verified).toBe(false);
    expect(first.rateLimited).toBeUndefined();
    const second = await verifyAdminTotp(env, "p1", "rl-user", "000000");
    expect(second.verified).toBe(false);
    expect(second.rateLimited).toBe(true);
  });

  it("A2-20: an unreadable secret fails closed instead of throwing", async () => {
    // Sealed value with no WEBHOOK_SECRET_ENCRYPTION_KEY in env → decrypt fails.
    const { env } = mockEnv({ secret: "enc:v1:AAAAAAAAAAAAAAAA:AAAA" });
    const result = await verifyAdminTotp(env, "p1", "u1", "123456");
    expect(result.verified).toBe(false);
    expect(result.reason).toBe("secret_unreadable");
  });

  it("does not rate limit users without 2FA enabled (audit F-29: no silent pass)", async () => {
    const { env } = mockEnv({ rateLimit: 1 });
    const first = await verifyAdminTotp(env, "p1", "no-2fa", "000000");
    const second = await verifyAdminTotp(env, "p1", "no-2fa", "000000");
    expect(first).toEqual({ verified: false, reason: "totp_not_configured" });
    expect(second).toEqual({ verified: false, reason: "totp_not_configured" });
  });

  it("accepts a TOTP code once and rejects its replay (audit F-32)", async () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const { env } = mockEnv({ secret });
    const code = await currentTotp(secret);
    const first = await verifyAdminTotp(env, "p1", "replay-user", code);
    expect(first).toMatchObject({ verified: true, method: "totp" });
    const replay = await verifyAdminTotp(env, "p1", "replay-user", code);
    expect(replay.verified).toBe(false);
    expect(replay.reason).toBe("code_reused");
  });
});
