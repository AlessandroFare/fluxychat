import { describe, it, expect, vi } from "vitest";
import {
  parseAllowedOrigins,
  isDemoOriginAllowed,
  guardDemoSessionRequest,
} from "./demo-guard.js";

vi.mock("./ip-rate-limit.js", () => ({
  checkAndConsumeIpRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock("./turnstile.js", () => ({
  isTurnstileConfigured: vi.fn(() => false),
  verifyTurnstileToken: vi.fn(),
}));

describe("demo-guard", () => {
  it("parseAllowedOrigins splits comma list", () => {
    expect(parseAllowedOrigins("https://a.com, https://b.com")).toEqual([
      "https://a.com",
      "https://b.com",
    ]);
  });

  it("isDemoOriginAllowed matches Origin header", () => {
    const req = new Request("https://api/demo/session", {
      headers: { Origin: "https://app.example.com" },
    });
    expect(isDemoOriginAllowed(req, ["https://app.example.com"])).toBe(true);
    expect(isDemoOriginAllowed(req, ["https://other.com"])).toBe(false);
  });

  it("guardDemoSessionRequest allows when origins unset in development", async () => {
    const result = await guardDemoSessionRequest(
      { NODE_ENV: "development" },
      new Request("https://api/demo/session", { method: "GET" }),
    );
    expect(result).toEqual({ ok: true });
  });

  it("guardDemoSessionRequest blocks empty allowlist in production", async () => {
    const result = await guardDemoSessionRequest(
      { NODE_ENV: "production" },
      new Request("https://api/demo/session", { method: "GET" }),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBe("demo_origin_forbidden");
  });

  it("guardDemoSessionRequest blocks wrong origin", async () => {
    const result = await guardDemoSessionRequest(
      { DEMO_ALLOWED_ORIGINS: "https://allowed.com" },
      new Request("https://api/demo/session", {
        method: "GET",
        headers: { Origin: "https://evil.com" },
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBe("demo_origin_forbidden");
  });
});
