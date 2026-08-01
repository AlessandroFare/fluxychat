import { describe, expect, it } from "vitest";
import { evaluateBranchPolicy } from "./message-branch.js";

describe("evaluateBranchPolicy", () => {
  const agentRoomTail = [
    { id: 1, user_id: "alice" },
    { id: 2, user_id: "agent" },
    { id: 3, user_id: "alice" },
    { id: 4, user_id: "agent" },
  ];
  const msgs = [
    ...agentRoomTail,
    { id: 5, user_id: "bob" },
  ];

  it("allows branch from own message when tail is user+agent only", () => {
    const r = evaluateBranchPolicy(agentRoomTail, 3, "alice", ["agent"]);
    expect(r.allowed).toBe(true);
    expect(r.messageIds).toEqual([3, 4]);
  });

  it("blocks when another human replied after anchor", () => {
    const r = evaluateBranchPolicy(msgs, 1, "alice", ["agent"]);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("blocked_by_other_users");
  });

  it("allows agent-message retry when tail has no other humans", () => {
    const r = evaluateBranchPolicy(msgs.slice(0, 4), 4, "alice", ["agent"]);
    expect(r.allowed).toBe(true);
    expect(r.messageIds).toEqual([4]);
  });

  it("allows admin to branch through other users", () => {
    const r = evaluateBranchPolicy(msgs, 1, "alice", ["agent"], { isAdmin: true });
    expect(r.allowed).toBe(true);
    expect(r.messageIds).toHaveLength(5);
  });
});
