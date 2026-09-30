import { describe, expect, it } from "vitest";
import { isOperatorSlackWebhookUrl } from "./hitl-offroom-notify.js";
import { signHitlTapToken, verifyHitlTapToken } from "./hitl-tap-token.js";

describe("hitl off-room notify helpers", () => {
  it("allows only https hooks.slack.com", () => {
    expect(isOperatorSlackWebhookUrl("https://hooks.slack.com/services/T/B/x")).toBe(true);
    expect(isOperatorSlackWebhookUrl("https://evil.example/hooks.slack.com")).toBe(false);
    expect(isOperatorSlackWebhookUrl("http://hooks.slack.com/services/T/B/x")).toBe(false);
  });

  it("signs tap tokens that verify against the same payload bytes", async () => {
    const token = await signHitlTapToken("secret", {
      approvalId: "appr_1",
      action: "approve",
      userId: "u1",
      exp: Date.now() + 60_000,
    });
    const parsed = await verifyHitlTapToken("secret", token);
    expect(parsed.userId).toBe("u1");
    expect(await verifyHitlTapToken("wrong", token)).toBeNull();
  });
});
