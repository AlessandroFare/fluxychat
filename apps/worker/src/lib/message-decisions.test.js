import { describe, it, expect } from "vitest";
import {
  parseDecisionCreateInput,
  evaluateDecisionQuorum,
  buildDecisionSnapshot,
} from "./message-decisions.js";

describe("message-decisions", () => {
  it("parses valid decision with requiredRoles", () => {
    const r = parseDecisionCreateInput({
      content: "Approve budget?",
      requiredRoles: [{ role: "admin", count: 2 }],
      ttlSeconds: 86400,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.requiredRoles).toEqual([{ role: "admin", count: 2 }]);
      expect(r.ttlSeconds).toBe(86400);
    }
  });

  it("parses requiredAcks shorthand", () => {
    const r = parseDecisionCreateInput({
      content: "Ship it?",
      requiredAcks: 2,
      allowedRoles: ["owner"],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.requiredRoles[0].count).toBe(2);
    }
  });

  it("rejects missing content", () => {
    const r = parseDecisionCreateInput({ requiredRoles: [{ role: "admin", count: 1 }] });
    expect(r.ok).toBe(false);
  });

  it("evaluates quorum by role counts", () => {
    const required = [{ role: "admin", count: 2 }, { role: "owner", count: 1 }];
    const acks = [
      { userId: "a1", role: "admin" },
      { userId: "a2", role: "admin" },
      { userId: "o1", role: "owner" },
    ];
    expect(evaluateDecisionQuorum(required, acks)).toBe(true);
    expect(evaluateDecisionQuorum(required, acks.slice(0, 2))).toBe(false);
  });

  it("builds snapshot with progress", () => {
    const snap = buildDecisionSnapshot({
      messageId: 1,
      content: "Go?",
      requiredRoles: [{ role: "admin", count: 2 }],
      acks: [{ userId: "u1", role: "admin", ackedAt: "2026-01-01T00:00:00Z" }],
      state: "pending",
      expiresAt: "2026-01-03T00:00:00Z",
      ttlSeconds: 172800,
    });
    expect(snap.progress[0].current).toBe(1);
    expect(snap.progress[0].required).toBe(2);
    expect(snap.quorumMet).toBe(false);
  });
});
