import { describe, expect, it } from "vitest";
import { othersFromRoomState } from "./use-presence";

describe("othersFromRoomState", () => {
  it("merges presence members with live cursors and hides self", () => {
    const others = othersFromRoomState({
      selfUserId: "me",
      presenceMembers: [
        { userId: "me", userInfo: { name: "Me" } },
        { userId: "ada", userInfo: { name: "Ada" } },
      ],
      liveCursors: {
        ada: {
          userId: "ada",
          x: 4,
          y: 8,
          pointer: "mouse",
          ts: 1,
        },
        me: {
          userId: "me",
          x: 1,
          y: 1,
          pointer: "mouse",
          ts: 1,
        },
      },
    });
    expect(others).toHaveLength(1);
    expect(others[0]).toMatchObject({
      userId: "ada",
      presence: { cursor: { x: 4, y: 8 } },
      info: { name: "Ada" },
    });
  });

  it("merges selections from livePresence", () => {
    const others = othersFromRoomState({
      presenceMembers: [{ userId: "ada" }],
      liveCursors: {},
      livePresence: { ada: { selection: { x: 1, y: 2, x2: 3, y2: 4 } } },
    });
    expect(others[0]?.presence.selection).toEqual({ x: 1, y: 2, x2: 3, y2: 4 });
  });
});
