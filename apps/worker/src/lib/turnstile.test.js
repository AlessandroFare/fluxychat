import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifyTurnstileToken, isTurnstileConfigured } from "./turnstile.js";

describe("verifyTurnstileToken", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("skips verification when secret is unset", async () => {
    const result = await verifyTurnstileToken({}, undefined, new Request("https://x"));
    expect(result.success).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects missing token when secret is set", async () => {
    const result = await verifyTurnstileToken(
      { TURNSTILE_SECRET_KEY: "secret" },
      "",
      new Request("https://x"),
    );
    expect(result.success).toBe(false);
  });

  it("calls siteverify when token is provided", async () => {
    const result = await verifyTurnstileToken(
      { TURNSTILE_SECRET_KEY: "secret" },
      "token-abc",
      new Request("https://x", {
        headers: { "CF-Connecting-IP": "1.2.3.4" },
      }),
    );
    expect(result.success).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("isTurnstileConfigured", () => {
  it("returns true when secret is set", () => {
    expect(isTurnstileConfigured({ TURNSTILE_SECRET_KEY: "x" })).toBe(true);
  });
});
