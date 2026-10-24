import { describe, expect, it } from "vitest";
import { verifySmsOtp } from "./sms-otp-auth.js";

const future = new Date(Date.now() + 60_000).toISOString();
const past = new Date(Date.now() - 60_000).toISOString();

function mockEnv({ row = null, consumedChanges = 1 } = {}) {
  const runs = [];
  return {
    env: {
      SMS_OTP_ENABLED: "true",
      RATE_LIMIT_FALLBACK_ALLOW: "true",
      DB: {
        prepare(sql) {
          const text = String(sql);
          return {
            bind(...args) {
              return {
                async first() {
                  return text.includes("SELECT id, expires_at, consumed_at, attempts") ? row : null;
                },
                async run() {
                  runs.push({ text, args });
                  return {
                    meta: { changes: text.includes("SET consumed_at") ? consumedChanges : 1 },
                  };
                },
              };
            },
          };
        },
      },
    },
    runs,
  };
}

const opts = { projectId: "p1", userId: "u1", e164: "+393331234567", code: "123456" };

describe("verifySmsOtp (#20)", () => {
  it("consumes a valid code atomically", async () => {
    const { env, runs } = mockEnv({
      row: { id: "o1", expires_at: future, consumed_at: null, attempts: 0 },
    });
    const result = await verifySmsOtp(env, opts);
    expect(result.ok).toBe(true);
    expect(runs.some((r) => r.text.includes("SET consumed_at"))).toBe(true);
  });

  it("rejects when the atomic consume loses the race", async () => {
    const { env } = mockEnv({
      row: { id: "o1", expires_at: future, consumed_at: null, attempts: 0 },
      consumedChanges: 0,
    });
    const result = await verifySmsOtp(env, opts);
    expect(result.ok).toBe(false);
    expect(result.error).toBe("code_already_used");
  });

  it("counts a wrong guess against the live code", async () => {
    const { env, runs } = mockEnv({ row: null });
    const result = await verifySmsOtp(env, opts);
    expect(result.error).toBe("invalid_code");
    expect(runs.some((r) => r.text.includes("attempts = attempts + 1"))).toBe(true);
  });

  it("burns the code once attempts are exhausted", async () => {
    const { env, runs } = mockEnv({
      row: { id: "o1", expires_at: future, consumed_at: null, attempts: 5 },
    });
    const result = await verifySmsOtp(env, opts);
    expect(result.error).toBe("too_many_attempts");
    expect(runs.some((r) => r.text.includes("SET consumed_at"))).toBe(false);
  });

  it("rejects expired codes", async () => {
    const { env } = mockEnv({
      row: { id: "o1", expires_at: past, consumed_at: null, attempts: 0 },
    });
    const result = await verifySmsOtp(env, opts);
    expect(result.error).toBe("code_expired");
  });

  it("rejects reused codes", async () => {
    const { env } = mockEnv({
      row: { id: "o1", expires_at: future, consumed_at: past, attempts: 0 },
    });
    const result = await verifySmsOtp(env, opts);
    expect(result.error).toBe("code_already_used");
  });
});
