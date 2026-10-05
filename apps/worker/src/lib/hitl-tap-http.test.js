import { describe, expect, it, vi, beforeEach } from "vitest";
import { handlePublicHitlTap } from "./hitl-tap-http.js";
import { checkAndConsumeIpRateLimit } from "./ip-rate-limit.js";

vi.mock("./ip-rate-limit.js", () => ({
  checkAndConsumeIpRateLimit: vi.fn(async () => ({ allowed: true })),
}));

function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status || 200,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

describe("handlePublicHitlTap", () => {
  beforeEach(() => {
    checkAndConsumeIpRateLimit.mockReset();
    checkAndConsumeIpRateLimit.mockResolvedValue({ allowed: true });
  });

  it("returns HTML for a missing token", async () => {
    const res = await handlePublicHitlTap(
      new Request("https://api.example/public/hitl/tap"),
      new URL("https://api.example/public/hitl/tap"),
      { JWT_SECRET: "secret" },
      json,
      {},
    );
    expect(res.status).toBe(400);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain("invalid or expired");
    expect(body).not.toContain("Tool call approved");
  });

  it("GET with a valid token does not decide", async () => {
    const { signHitlTapToken } = await import("./hitl-tap-token.js");
    const token = await signHitlTapToken("secret", {
      approvalId: "appr_1",
      action: "approve",
      userId: "u1",
      exp: Date.now() + 60_000,
      payloadHash: "abc",
    });
    const res = await handlePublicHitlTap(
      new Request("https://api.example/public/hitl/tap?token=" + encodeURIComponent(token)),
      new URL("https://api.example/public/hitl/tap?token=" + encodeURIComponent(token)),
      { JWT_SECRET: "secret" },
      json,
      {},
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("method=\"post\"");
    expect(body).toContain("does not record a decision");
  });

  it("returns JSON when Accept is application/json", async () => {
    const res = await handlePublicHitlTap(
      new Request("https://api.example/public/hitl/tap?token=nope", {
        headers: { Accept: "application/json" },
      }),
      new URL("https://api.example/public/hitl/tap?token=nope"),
      { JWT_SECRET: "secret" },
      json,
      {},
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("invalid_token");
  });

  it("fails closed when the rate limiter throws", async () => {
    checkAndConsumeIpRateLimit.mockRejectedValueOnce(new Error("kv down"));
    const res = await handlePublicHitlTap(
      new Request("https://api.example/public/hitl/tap?token=nope", {
        headers: { Accept: "application/json" },
      }),
      new URL("https://api.example/public/hitl/tap?token=nope"),
      { JWT_SECRET: "secret" },
      json,
      {},
    );
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("rate_limited");
  });

  it("allows a limiter throw only when RATE_LIMIT_FALLBACK_ALLOW is set", async () => {
    checkAndConsumeIpRateLimit.mockRejectedValueOnce(new Error("kv down"));
    const res = await handlePublicHitlTap(
      new Request("https://api.example/public/hitl/tap?token=nope", {
        headers: { Accept: "application/json" },
      }),
      new URL("https://api.example/public/hitl/tap?token=nope"),
      { JWT_SECRET: "secret", RATE_LIMIT_FALLBACK_ALLOW: "true" },
      json,
      {},
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_token");
  });
});
