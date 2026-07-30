import { describe, expect, it } from "vitest";
import { inboxSummaryToItems, mergeInboxItem } from "./inbox-items";
import type { FluxyInboxSummary } from "./index";

describe("inbox-items", () => {
  it("flattens summary into items", () => {
    const summary: FluxyInboxSummary = {
      mentions: [
        {
          roomId: "r1",
          roomName: "General",
          messageId: 9,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      unreadRooms: [
        {
          roomId: "r2",
          roomName: "Support",
          unreadCount: 3,
          lastReadMessageId: 1,
          firstUnreadMessageId: 2,
        },
      ],
      snoozedRooms: [],
      followUps: [],
      counts: { mentions: 1, unreadRooms: 1, snoozedRooms: 0, followUps: 0 },
    };
    const items = inboxSummaryToItems(summary);
    expect(items).toHaveLength(2);
    expect(items[0]?.kind).toBe("mention");
    expect(items[1]?.kind).toBe("unread");
  });

  it("mergeInboxItem dedupes by id", () => {
    const base = inboxSummaryToItems({
      mentions: [],
      unreadRooms: [
        {
          roomId: "r1",
          roomName: "A",
          unreadCount: 1,
          lastReadMessageId: 0,
          firstUnreadMessageId: 1,
        },
      ],
      snoozedRooms: [],
      followUps: [],
      counts: { mentions: 0, unreadRooms: 1, snoozedRooms: 0, followUps: 0 },
    });
    const merged = mergeInboxItem(base, {
      ...base[0]!,
      unreadCount: 5,
      receivedAt: "2026-02-01T00:00:00.000Z",
    });
    expect(merged).toHaveLength(1);
    expect(merged[0]?.unreadCount).toBe(5);
  });
});
