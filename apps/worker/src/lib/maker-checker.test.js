import { describe, expect, it } from "vitest";
import { assertMakerCheckerDecision } from "./maker-checker.js";

describe("assertMakerCheckerDecision", () => {
  it("no-ops when makerChecker is off", () => {
    expect(assertMakerCheckerDecision({ makerChecker: false, decidedBy: "same", requesterUserId: "same" })).toEqual({
      ok: true,
    });
  });

  it("blocks requester self-approve and agent approve", () => {
    expect(
      assertMakerCheckerDecision({
        makerChecker: true,
        requesterUserId: "u1",
        decidedBy: "u1",
      }).error,
    ).toBe("requester_cannot_approve");
    expect(
      assertMakerCheckerDecision({
        makerChecker: true,
        requesterUserId: "u1",
        decidedBy: "bot",
        agentId: "bot",
      }).error,
    ).toBe("agent_cannot_approve");
    expect(
      assertMakerCheckerDecision({
        makerChecker: true,
        requesterUserId: "u1",
        decidedBy: "u2",
      }),
    ).toEqual({ ok: true });
  });
});
