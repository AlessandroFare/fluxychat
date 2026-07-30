import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useInbox } from "@fluxy-chat/react";
import type { FluxyChatClient, FluxyInboxSummary } from "@fluxy-chat/sdk";

const emptySummary: FluxyInboxSummary = {
  mentions: [],
  unreadRooms: [],
  snoozedRooms: [],
  followUps: [],
  counts: { mentions: 0, unreadRooms: 0, snoozedRooms: 0, followUps: 0 },
};

function createMockClient(options?: {
  onConnect?: (send: (data: unknown) => void) => void;
}) {
  let messageHandler: ((ev: MessageEvent) => void) | null = null;
  const ws = {
    addEventListener: (event: string, handler: (ev: MessageEvent) => void) => {
      if (event === "message") messageHandler = handler;
    },
    removeEventListener: vi.fn(),
    close: vi.fn(),
    addEventListenerCapture: vi.fn(),
  };

  const client = {
    isAuthenticated: () => true,
    resolveToken: vi.fn().mockResolvedValue(undefined),
    getInbox: vi.fn().mockResolvedValue(emptySummary),
    connectUser: () => {
      options?.onConnect?.((data) => {
        messageHandler?.({ data: JSON.stringify(data) } as MessageEvent);
      });
      return ws as unknown as WebSocket;
    },
  };

  return client as unknown as FluxyChatClient;
}

describe("useInbox onItem", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls onItem when user channel pushes an inbox item", async () => {
    const onItem = vi.fn();
    let push: ((data: unknown) => void) | null = null;
    const client = createMockClient({
      onConnect: (send) => {
        push = send;
      },
    });

    renderHook(() =>
      useInbox({
        client,
        enabled: true,
        pollIntervalMs: 0,
        onItem,
      }),
    );

    await waitFor(() => expect(client.getInbox).toHaveBeenCalled());

    act(() => {
      push?.({
        type: "user_event",
        name: "inbox_item",
        data: {
          kind: "unread",
          roomId: "room-live-1",
          roomName: "Live Room",
          unreadCount: 2,
          id: "unread:room-live-1",
        },
      });
    });

    await waitFor(() => expect(onItem).toHaveBeenCalledTimes(1));
    expect(onItem.mock.calls[0]?.[0]).toMatchObject({
      kind: "unread",
      roomId: "room-live-1",
      roomName: "Live Room",
      unreadCount: 2,
    });
  });

  it("exposes items feed from REST summary", async () => {
    const summary: FluxyInboxSummary = {
      ...emptySummary,
      unreadRooms: [
        {
          roomId: "room-a",
          roomName: "General",
          unreadCount: 3,
          lastReadMessageId: 1,
          firstUnreadMessageId: 2,
        },
      ],
      counts: { ...emptySummary.counts, unreadRooms: 1 },
    };
    const client = createMockClient();
    (client.getInbox as ReturnType<typeof vi.fn>).mockResolvedValue(summary);

    const { result } = renderHook(() =>
      useInbox({ client, enabled: true, pollIntervalMs: 0 }),
    );

    await waitFor(() => expect(result.current.items.length).toBe(1));
    expect(result.current.items[0]?.kind).toBe("unread");
    expect(result.current.counter).toBe(1);
  });
});
