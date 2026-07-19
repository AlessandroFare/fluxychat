import { describe, expect, it } from "vitest";
import { createVerticalPlatform } from "./vertical-platform";

const makePlatform = () => createVerticalPlatform({
  workspaceId: "ws_1",
  roomId: "room_1",
  vertical: "edu",
  capabilities: [{ id: "poll", readiness: "beta", policy: { allowedRoles: ["teacher", "student"], retentionDays: 30 } }],
});

describe("vertical platform", () => {
  it("isolates event tenants and makes publish idempotent", () => {
    const platform = makePlatform();
    const input = { workspaceId: "ws_1", roomId: "room_1", type: "class.started", actor: { id: "teacher", type: "user" as const }, idempotencyKey: "start-1", payload: {} };
    expect(platform.publish(input).eventId).toBe(platform.publish(input).eventId);
    expect(platform.events()).toHaveLength(1);
    expect(() => platform.publish({ ...input, workspaceId: "other", idempotencyKey: "other" })).toThrow(/tenant/);
  });

  it("accepts one vote per user and closes polls", () => {
    const platform = makePlatform();
    const poll = platform.createPoll({ question: "Ready?", allowMultiple: false, options: [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }] });
    expect(platform.vote({ pollId: poll.id, optionIds: ["yes"], userId: "u1", idempotencyKey: "vote-1" })).toBe(true);
    expect(platform.vote({ pollId: poll.id, optionIds: ["no"], userId: "u1", idempotencyKey: "vote-2" })).toBe(false);
    expect(platform.pollResults(poll.id)).toEqual({ yes: 1, no: 0 });
    expect(platform.closePoll(poll.id)).toBe(true);
    expect(platform.vote({ pollId: poll.id, optionIds: ["no"], userId: "u2", idempotencyKey: "vote-3" })).toBe(false);
  });
});
