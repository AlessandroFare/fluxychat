import { describe, expect, it, vi } from "vitest";
import {
  canUserSeeMessage,
  messageVisibilitySql,
  parseRoleFromVisibility,
  resolveMessageVisibility,
  resolveVisibilityRecipientUserIds,
  whisperRecipientSet,
} from "./message-visibility.js";

describe("message-visibility", () => {
  it("requires visibleTo for whisper", () => {
    expect(resolveMessageVisibility({ visibility: "whisper" }).ok).toBe(false);
  });

  it("accepts role:evaluator visibility", () => {
    const result = resolveMessageVisibility({ visibility: "role:evaluator" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.visibility).toBe("role:evaluator");
      expect(result.visibleTo).toEqual([]);
    }
  });

  it("rejects invalid role names", () => {
    expect(resolveMessageVisibility({ visibility: "role:" }).ok).toBe(false);
    expect(resolveMessageVisibility({ visibility: "role:bad name" }).ok).toBe(false);
    expect(resolveMessageVisibility({ visibility: "role:UPPER" }).ok).toBe(true);
  });

  it("parses role from visibility", () => {
    expect(parseRoleFromVisibility("role:evaluator")).toBe("evaluator");
    expect(parseRoleFromVisibility("room")).toBe(null);
  });

  it("whisper recipients include sender", () => {
    const set = whisperRecipientSet("whisper", ["bob"], "alice");
    expect(set?.has("alice")).toBe(true);
    expect(set?.has("bob")).toBe(true);
  });

  it("filters whisper for non-recipients", () => {
    expect(
      canUserSeeMessage("whisper", '["bob"]', "carol", "alice"),
    ).toBe(false);
    expect(canUserSeeMessage("whisper", '["bob"]', "bob", "alice")).toBe(true);
  });

  it("filters role visibility by viewer role", () => {
    expect(
      canUserSeeMessage("role:evaluator", null, "carol", "alice", "member"),
    ).toBe(false);
    expect(
      canUserSeeMessage("role:evaluator", null, "bob", "alice", "evaluator"),
    ).toBe(true);
    expect(canUserSeeMessage("role:evaluator", null, "alice", "alice", "member")).toBe(
      true,
    );
  });

  it("includes role subquery for history queries", () => {
    const vis = messageVisibilitySql("user_1");
    expect(vis.sql).toContain("room_members");
    expect(vis.binds).toContain("user_1");
  });

  it("resolves role recipients from room_members", async () => {
    const env = {
      DB: {
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            all: vi.fn(async () => ({
              results: [{ user_id: "eval_1" }, { user_id: "eval_2" }],
            })),
          })),
        })),
      },
    };

    const recipients = await resolveVisibilityRecipientUserIds(
      env,
      "room_1",
      "role:evaluator",
      [],
      "agent_1",
    );

    expect(recipients?.has("agent_1")).toBe(true);
    expect(recipients?.has("eval_1")).toBe(true);
    expect(recipients?.has("eval_2")).toBe(true);
    expect(recipients?.has("candidate_1")).toBe(false);
  });
});
