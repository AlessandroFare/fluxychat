import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  guardPublicGuestRequest,
  getPublicGuestHardeningConfig,
} from "./public-guest-guard.js";

vi.mock("./demo-guard.js", () => ({
  parseAllowedOrigins: vi.fn(() => ["https://app.example.com"]),
  isDemoOriginAllowed: vi.fn(() => true),
}));

vi.mock("./ip-rate-limit.js", () => ({
  checkAndConsumeIpRateLimit: vi.fn(async () => ({ allowed: true })),
}));

vi.mock("./turnstile.js", () => ({
  isTurnstileConfigured: vi.fn(() => false),
  verifyTurnstileToken: vi.fn(async () => ({ success: true })),
}));

vi.mock("./embed-config.js", () => ({
  validateEmbedParentOrigin: vi.fn(async () => ({ ok: true })),
}));

import { isDemoOriginAllowed } from "./demo-guard.js";
import { checkAndConsumeIpRateLimit } from "./ip-rate-limit.js";
import { isTurnstileConfigured, verifyTurnstileToken } from "./turnstile.js";

describe("getPublicGuestHardeningConfig", () => {
  it("returns defaults when env unset", () => {
    const cfg = getPublicGuestHardeningConfig({});
    expect(cfg.publicGuestEnabled).toBe(false);
    expect(cfg.readOnlyGuest).toBe(false);
    expect(cfg.rateLimitPerMinute).toBe(30);
    expect(cfg.turnstile.required).toBe(false);
    expect(cfg.turnstile.siteKey).toBeNull();
  });

  it("exposes site key when Turnstile configured", () => {
    isTurnstileConfigured.mockReturnValue(true);
    const cfg = getPublicGuestHardeningConfig({
      TURNSTILE_SECRET_KEY: "secret",
      TURNSTILE_SITE_KEY: "site-key-public",
      PUBLIC_GUEST_TURNSTILE_REQUIRED: "true",
    });
    expect(cfg.turnstile.required).toBe(true);
    expect(cfg.turnstile.siteKey).toBe("site-key-public");
  });
});

describe("guardPublicGuestRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isDemoOriginAllowed.mockReturnValue(true);
    checkAndConsumeIpRateLimit.mockResolvedValue({ allowed: true });
    isTurnstileConfigured.mockReturnValue(false);
  });

  it("blocks forbidden origin", async () => {
    isDemoOriginAllowed.mockReturnValue(false);
    const result = await guardPublicGuestRequest({}, new Request("https://x"), {});
    expect(result.ok).toBe(false);
    expect(result.error).toBe("origin_forbidden");
  });

  it("blocks when rate limit exceeded", async () => {
    checkAndConsumeIpRateLimit.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 42,
    });
    const result = await guardPublicGuestRequest({}, new Request("https://x"), {});
    expect(result.ok).toBe(false);
    expect(result.status).toBe(429);
    expect(result.retryAfterSeconds).toBe(42);
  });

  it("requires Turnstile when configured and required", async () => {
    isTurnstileConfigured.mockReturnValue(true);
    verifyTurnstileToken.mockResolvedValue({ success: false });
    const env = { PUBLIC_GUEST_TURNSTILE_REQUIRED: "true", TURNSTILE_SECRET_KEY: "s" };
    const result = await guardPublicGuestRequest(env, new Request("https://x"), {});
    expect(result.ok).toBe(false);
    expect(result.error).toBe("turnstile_failed");
  });

  it("passes with valid Turnstile token", async () => {
    isTurnstileConfigured.mockReturnValue(true);
    verifyTurnstileToken.mockResolvedValue({ success: true });
    const env = { PUBLIC_GUEST_TURNSTILE_REQUIRED: "true", TURNSTILE_SECRET_KEY: "s" };
    const result = await guardPublicGuestRequest(env, new Request("https://x"), {
      turnstileToken: "token",
    });
    expect(result.ok).toBe(true);
  });
});
