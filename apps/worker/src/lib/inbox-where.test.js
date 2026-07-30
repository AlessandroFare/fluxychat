import { describe, expect, it } from "vitest";
import { applyInboxQuery, parseInboxQueryParams } from "./inbox-where.js";

describe("inbox-where", () => {
  const summary = {
    mentions: [{ roomId: "r1" }, { roomId: "r2" }],
    unreadRooms: [
      { roomId: "r1", roomName: "Alpha", unreadCount: 3, snoozedUntil: null },
      { roomId: "r2", roomName: "Beta", unreadCount: 1, snoozedUntil: null },
    ],
    snoozedRooms: [],
    followUps: [{ roomId: "r1" }],
    counts: { mentions: 2, unreadRooms: 2, snoozedRooms: 0, followUps: 1 },
  };

  it("filters unread rooms by where clause", () => {
    const filtered = applyInboxQuery(summary, {
      where: { unreadCount: { gt: 2 } },
    });
    expect(filtered.unreadRooms).toHaveLength(1);
    expect(filtered.unreadRooms[0].roomId).toBe("r1");
    expect(filtered.counts.unreadRooms).toBe(1);
  });

  it("scopes to roomId", () => {
    const filtered = applyInboxQuery(summary, { roomId: "r1" });
    expect(filtered.mentions).toHaveLength(1);
    expect(filtered.followUps).toHaveLength(1);
  });

  it("parses query params", () => {
    const parsed = parseInboxQueryParams("room-a", JSON.stringify({ roomType: { eq: "channel" } }));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.query.roomId).toBe("room-a");
      expect(parsed.query.where).toEqual({ roomType: { eq: "channel" } });
    }
  });

  it("rejects invalid where json", () => {
    expect(parseInboxQueryParams(null, "not-json").ok).toBe(false);
  });
});
