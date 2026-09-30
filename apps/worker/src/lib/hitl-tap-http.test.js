import { describe, expect, it } from "vitest";
import { handlePublicHitlTap } from "./hitl-tap-http.js";

function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status || 200,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

describe("handlePublicHitlTap", () => {
  it("returns HTML for a missing token", async () => {
    const res = await handlePublicHitlTap(
      new Request("https://api.example/public/hitl/tap"),
      new URL("https://api.example/public/hitl/tap"),
      { JWT_SECRET: "secret", RATE_LIMIT_FALLBACK_ALLOW: "true" },
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
      { JWT_SECRET: "secret", RATE_LIMIT_FALLBACK_ALLOW: "true" },
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
      { JWT_SECRET: "secret", RATE_LIMIT_FALLBACK_ALLOW: "true" },
      json,
      {},
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("invalid_token");
  });
});
