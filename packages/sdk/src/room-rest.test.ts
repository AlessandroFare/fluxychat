import { describe, expect, it } from "vitest";
import { normalizeRoomMember, normalizeRoomMembers } from "./room-rest";

describe("room-rest", () => {
  it("normalizeRoomMember maps user_id to userId", () => {
    const member = normalizeRoomMember({ user_id: "alice", role: "owner" });
    expect(member).toEqual({ userId: "alice", role: "owner", joined_at: undefined });
  });

  it("normalizeRoomMembers skips invalid rows", () => {
    const members = normalizeRoomMembers([
      { user_id: "a", role: "member" },
      { role: "member" },
      null,
    ]);
    expect(members).toHaveLength(1);
    expect(members[0]?.userId).toBe("a");
  });
});
