import { describe, expect, it } from "vitest";
import { signHitlTapToken, verifyHitlTapToken } from "./hitl-tap-token.js";

describe("hitl-tap-token", () => {
  it("round-trips a tap token", async () => {
    const token = await signHitlTapToken("secret", {
      approvalId: "appr_1",
      action: "approve",
      userId: "u1",
      exp: Date.now() + 60_000,
    });
    const parsed = await verifyHitlTapToken("secret", token);
    expect(parsed.approvalId).toBe("appr_1");
    expect(parsed.action).toBe("approve");
    expect(parsed.jti).toBeTruthy();
  });

  it("rejects expired tokens", async () => {
    const token = await signHitlTapToken("secret", {
      approvalId: "appr_1",
      action: "deny",
      userId: "u1",
      exp: Date.now() - 1000,
    });
    expect(await verifyHitlTapToken("secret", token)).toBeNull();
  });

  it("A2f: rejects tokens without exp (fail closed)", async () => {
    const token = await signHitlTapToken("secret", {
      approvalId: "appr_1",
      action: "approve",
      userId: "u1",
    });
    expect(await verifyHitlTapToken("secret", token)).toBeNull();
  });

  it("A2f: rejects tokens with an unparseable exp", async () => {
    const token = await signHitlTapToken("secret", {
      approvalId: "appr_1",
      action: "approve",
      userId: "u1",
      exp: "not-a-number",
    });
    expect(await verifyHitlTapToken("secret", token)).toBeNull();
  });
});
