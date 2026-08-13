import { describe, it, expect, vi } from "vitest";
import { assertCanPostToRoom } from "./room-post-policy.js";

vi.mock("./message-decisions.js", () => ({
  getRoomMemberRole: vi.fn(async (_env, _roomId, userId) => {
    if (userId === "admin1") return "admin";
    return "member";
  }),
}));

function makeEnv(type = "group") {
  return {
    DB: {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(async () => ({ type })),
        })),
      })),
    },
  };
}

describe("NW-131 room-post-policy", () => {
  it("allows members in normal group rooms", async () => {
    const result = await assertCanPostToRoom(makeEnv("group"), {
      projectId: "p1",
      roomId: "r1",
      userId: "u1",
    });
    expect(result.ok).toBe(true);
  });

  it("blocks members in announcement rooms", async () => {
    const result = await assertCanPostToRoom(makeEnv("announcement"), {
      projectId: "p1",
      roomId: "r1",
      userId: "u1",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("announcement_read_only");
  });

  it("allows admins in announcement rooms", async () => {
    const result = await assertCanPostToRoom(makeEnv("announcement"), {
      projectId: "p1",
      roomId: "r1",
      userId: "admin1",
    });
    expect(result.ok).toBe(true);
  });
});
