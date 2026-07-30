import { describe, expect, it } from "vitest";
import {
  applyInboxQuery,
  isInboxRefreshUserEvent,
  type FluxyInboxSummaryLike,
} from "./inbox-filter";

const sample: FluxyInboxSummaryLike = {
  mentions: [],
  unreadRooms: [
    {
      roomId: "r1",
      roomName: "Alpha",
      unreadCount: 3,
      lastReadMessageId: 10,
      firstUnreadMessageId: 11,
    },
    {
      roomId: "r2",
      roomName: "Beta",
      unreadCount: 0,
      lastReadMessageId: 5,
      firstUnreadMessageId: null,
    },
  ],
  snoozedRooms: [],
  followUps: [],
  counts: { mentions: 0, unreadRooms: 2, snoozedRooms: 0, followUps: 0 },
};

describe("applyInboxQuery", () => {
  it("filters by roomId scope", () => {
    const filtered = applyInboxQuery(sample, { roomId: "r1" });
    expect(filtered.unreadRooms).toHaveLength(1);
    expect(filtered.unreadRooms[0]?.roomId).toBe("r1");
  });

  it("filters with where grammar", () => {
    const filtered = applyInboxQuery(sample, {
      where: { unreadCount: { gt: 0 } },
    });
    expect(filtered.unreadRooms).toHaveLength(1);
    expect(filtered.unreadRooms[0]?.roomId).toBe("r1");
  });
});

describe("isInboxRefreshUserEvent", () => {
  it("detects inbox_updated user_event", () => {
    expect(
      isInboxRefreshUserEvent({ type: "user_event", name: "inbox_updated" }),
    ).toBe(true);
  });

  it("ignores unrelated events", () => {
    expect(isInboxRefreshUserEvent({ type: "message", name: "ping" })).toBe(false);
  });
});
