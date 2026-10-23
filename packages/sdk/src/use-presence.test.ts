import { describe, expect, it } from "vitest";
import { lostConnectionEventFromStatus, othersFromRoomState } from "./use-presence";

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

  it("keeps named cursor layers out of presence so the default cursor survives", () => {
    const others = othersFromRoomState({
      presenceMembers: [{ userId: "ada" }],
      liveCursors: {
        ada: { userId: "ada", x: 4, y: 8, pointer: "mouse", ts: 1 },
        "ada#agent": { userId: "ada", presenceKey: "agent", x: 90, y: 90, pointer: "mouse", ts: 2 },
      },
    });
    expect(others).toHaveLength(1);
    expect(others[0]?.presence.cursor).toEqual({ x: 4, y: 8 });
  });
});

describe("lostConnectionEventFromStatus", () => {
  it("maps reconnect and restore", () => {
    expect(lostConnectionEventFromStatus("connected", "reconnecting")).toBe("lost");
    expect(lostConnectionEventFromStatus("reconnecting", "connected")).toBe("restored");
    expect(lostConnectionEventFromStatus("connected", "failed")).toBe("failed");
    expect(lostConnectionEventFromStatus("connected", "connected")).toBeNull();
  });
});
