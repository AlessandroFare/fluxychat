import { describe, expect, it } from "vitest";
import { parseAsymmetryProfile } from "./room-session-profile.js";
import { assertNegotiationFloorPrice } from "./cross-org-rooms.js";

describe("room-session-profile", () => {
  it("parses evaluator pack", () => {
    const parsed = parseAsymmetryProfile({
      name: "interview_eval",
      roles: {
        evaluator: { privateHints: true, aiNotes: true, panel: "notes" },
        member: { privateHints: false, aiNotes: false, panel: "candidate" },
      },
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.profile.roles.evaluator.aiNotes).toBe(true);
      expect(parsed.profile.roles.member.aiNotes).toBe(false);
    }
  });
});

describe("negotiation floor price", () => {
  it("rejects price below floor", () => {
    const result = assertNegotiationFloorPrice({
      floorPrice: 10,
      unit_price_usd: 8,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("below_floor_price");
  });

  it("allows price at or above floor", () => {
    expect(assertNegotiationFloorPrice({ floorPrice: 10, unit_price_usd: 10 }).ok).toBe(true);
  });
});
