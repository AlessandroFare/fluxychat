import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/sms-otp-auth.js", () => ({
  requestSmsOtp: vi.fn(async () => ({ ok: true, sent: true })),
  verifySmsOtp: vi.fn(async () => ({ ok: true })),
}));

import { dispatchPublicRoutes } from "./public-http.js";

function buildDeps(overrides = {}) {
  return {
    env: { NODE_ENV: "test", ...(overrides.env || {}) },
    ctx: { waitUntil() {} },
    traceId: "trace-test",
    json(body, init = {}) {
      return new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { "Content-Type": "application/json" },
      });
    },
    corsHeaders: {},
    requestLogCtx: {},
    verifyJwtAndGetContext: async () => null,
    hasAnyRole: () => false,
    logError: () => {},
    writeAuditEvent: async () => {},
    sanitizeString: (value) => value,
    validateFileUpload: () => ({ valid: true }),
    getFileExtension: () => "",
    resolveProjectId: async () => "proj-test",
    insertNewProject: async () => ({}),
    isValidId: (id) => /^[a-zA-Z0-9_-]{1,128}$/.test(id),
    validateRoles: () => ({ valid: true, roles: ["member"] }),
    signJwtHs256: async () => "jwt",
    maxRoomNameLength: 128,
    projectId: "default",
    checkAndConsumeRateLimit: async () => ({ allowed: true, retryAfterSeconds: 0 }),
    canAccessRoom: async () => true,
    customDomain: null,
    timingSafeEqual: async (a, b) => a === b,
    ...overrides,
    env: { NODE_ENV: "test", ...(overrides.env || {}) },
  };
}

describe("sms-otp routes (audit F-20)", () => {
  it("rejects publishable key on /auth/sms-otp/send", async () => {
    const req = new Request("https://api.example.com/auth/sms-otp/send", {
      method: "POST",
      headers: { "X-Fluxy-Api-Key": "pk_attacker", "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "victim", e164: "+15550001111" }),
    });
    const res = await dispatchPublicRoutes(req, new URL(req.url), buildDeps());
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("publishable_key_not_allowed");
  });

  it("rejects publishable key on /auth/sms-otp/verify", async () => {
    const req = new Request("https://api.example.com/auth/sms-otp/verify", {
      method: "POST",
      headers: { "X-Fluxy-Api-Key": "pk_attacker", "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "victim", e164: "+15550001111", code: "123456" }),
    });
    const res = await dispatchPublicRoutes(req, new URL(req.url), buildDeps());
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("publishable_key_not_allowed");
  });

  it("still requires an api key at all", async () => {
    const req = new Request("https://api.example.com/auth/sms-otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "u", e164: "+15550000000" }),
    });
    const res = await dispatchPublicRoutes(req, new URL(req.url), buildDeps());
    expect(res.status).toBe(401);
  });

  it("A2-23: a non-numeric ttlSeconds falls back instead of minting exp: null", async () => {
    const captured = [];
    const deps = buildDeps({
      env: {
        DB: { prepare: () => ({ bind: () => ({ first: async () => ({ jwt_secret: "s" }) }) }) },
      },
      signJwtHs256: async (_secret, payload) => {
        captured.push(payload);
        return "jwt";
      },
    });
    const req = new Request("https://api.example.com/auth/sms-otp/verify", {
      method: "POST",
      headers: { "X-Fluxy-Api-Key": "sk_test", "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: "u1",
        e164: "+15550001111",
        code: "123456",
        ttlSeconds: "abc",
      }),
    });
    const res = await dispatchPublicRoutes(req, new URL(req.url), deps);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.expiresIn).toBe(3600);
    expect(Number.isFinite(captured[0].exp)).toBe(true);
  });
});
