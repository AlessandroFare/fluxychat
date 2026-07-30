import { describe, expect, it } from "vitest";
import {
  createFluxyChatMockClient,
  createSpyAdapter,
  registerFluxyChatMatchers,
} from "./testing-utils";

registerFluxyChatMatchers(expect);

describe("createSpyAdapter", () => {
  it("records postMessage and editMessage calls", async () => {
    const adapter = createSpyAdapter();
    await adapter.postMessage("thread-1", "hello");
    await adapter.editMessage("thread-1", "msg-1", "hello world");

    expect(adapter).toHavePosted("thread-1", "hello");
    expect(adapter).toHaveEdited("thread-1", "msg-1", "hello world");
  });
});

describe("createFluxyChatMockClient", () => {
  it("returns configurable inbox summary", async () => {
    const client = createFluxyChatMockClient({
      inbox: {
        mentions: [],
        unreadRooms: [
          {
            roomId: "r1",
            roomName: "General",
            unreadCount: 2,
            lastReadMessageId: 1,
            firstUnreadMessageId: 2,
          },
        ],
        snoozedRooms: [],
        followUps: [],
        counts: { mentions: 0, unreadRooms: 1, snoozedRooms: 0, followUps: 0 },
      },
    });

    const inbox = await client.getInbox();
    expect(inbox.unreadRooms).toHaveLength(1);
    expect(client.isAuthenticated()).toBe(true);
  });
});
