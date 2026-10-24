import { describe, expect, it } from "vitest";
import { computeOversight } from "./ops-oversight.js";

/** 2026-10-18T12:00:SSZ — one clock for every case. */
function at(seconds) {
  return new Date(Date.UTC(2026, 9, 18, 12, 0, seconds)).toISOString();
}

function approval(overrides = {}) {
  return { id: "oap_1", createdAt: at(0), status: "pending", required: 1, decisions: [], ...overrides };
}

describe("computeOversight", () => {
  it("returns zeroed metrics when there is nothing to measure", () => {
    expect(computeOversight([], {})).toMatchObject({
      requested: 0,
      pending: 0,
      decided: 0,
      approved: 0,
      denied: 0,
      medianDecisionSeconds: null,
      fastDecisions: 0,
      fastShare: null,
      quorumRequested: 0,
      quorumMet: 0,
      quorumRate: null,
      distinctApprovers: 0,
      toolDenials: 0,
      rubberStamp: false,
    });
  });

  it("measures decision latency from creation to the closing decision", () => {
    const result = computeOversight([
      approval({ status: "approved", decisions: [{ actor: "a", decision: "approve", at: at(4) }] }),
      approval({ status: "denied", decisions: [{ actor: "b", decision: "deny", at: at(96) }] }),
      approval({ status: "pending" }),
    ]);
    expect(result.requested).toBe(3);
    expect(result.decided).toBe(2);
    expect(result.approved).toBe(1);
    expect(result.denied).toBe(1);
    expect(result.medianDecisionSeconds).toBe(50);
    expect(result.fastDecisions).toBe(1);
    expect(result.fastShare).toBe(0.5);
    expect(result.distinctApprovers).toBe(2);
  });

  it("times quorum at the vote that closes it and tracks participation", () => {
    const result = computeOversight([
      approval({
        status: "approved",
        required: 2,
        decisions: [
          { actor: "a", decision: "approve", at: at(2) },
          { actor: "b", decision: "approve", at: at(30) },
        ],
      }),
      approval({
        status: "denied",
        required: 2,
        decisions: [
          { actor: "c", decision: "approve", at: at(5) },
          { actor: "d", decision: "deny", at: at(9) },
        ],
      }),
    ]);
    expect(result.medianDecisionSeconds).toBe(19.5);
    expect(result.quorumRequested).toBe(2);
    expect(result.quorumMet).toBe(1);
    expect(result.quorumRate).toBe(0.5);
    expect(result.distinctApprovers).toBe(4);
  });

  it("raises the rubber-stamp signal only with enough fast decisions", () => {
    const fast = Array.from({ length: 4 }, (_, index) =>
      approval({ id: `oap_${index}`, status: "approved", decisions: [{ actor: "a", decision: "approve", at: at(1) }] }),
    );
    expect(computeOversight(fast).rubberStamp).toBe(false);

    const five = [...fast, approval({ id: "oap_5", status: "approved", decisions: [{ actor: "b", decision: "approve", at: at(2) }] })];
    const stamped = computeOversight(five);
    expect(stamped.fastShare).toBe(1);
    expect(stamped.rubberStamp).toBe(true);

    const diluted = [
      ...five,
      ...Array.from({ length: 5 }, (_, index) =>
        approval({ id: `slow_${index}`, status: "approved", decisions: [{ actor: "c", decision: "approve", at: at(600) }] }),
      ),
    ];
    expect(computeOversight(diluted).rubberStamp).toBe(false);
  });

  it("scopes the window and counts tool denials from the period events", () => {
    const result = computeOversight(
      [
        approval({
          createdAt: "2026-09-01T00:00:00.000Z",
          status: "approved",
          decisions: [{ actor: "a", decision: "approve", at: "2026-09-01T00:00:05.000Z" }],
        }),
        approval({ status: "approved", decisions: [{ actor: "b", decision: "approve", at: at(3) }] }),
      ],
      {
        from: "2026-10-01T00:00:00.000Z",
        events: [
          { eventType: "ops.tool.denied" },
          { eventType: "ops.tool.called" },
          { eventType: "ops.tool.denied" },
        ],
      },
    );
    expect(result.requested).toBe(1);
    expect(result.medianDecisionSeconds).toBe(3);
    expect(result.toolDenials).toBe(2);
  });
});
