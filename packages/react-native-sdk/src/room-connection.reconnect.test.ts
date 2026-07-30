import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { FluxyRoomConnection } from "./room-connection";
import type { FluxyChatClient } from "./index";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: ((ev: { code: number; reason: string }) => void) | null = null;

  constructor(_url: string) {
    MockWebSocket.instances.push(this);
  }

  addEventListener(type: string, handler: (ev: unknown) => void) {
    if (type === "open") this.onopen = handler as () => void;
    if (type === "message") this.onmessage = handler as (ev: { data: string }) => void;
    if (type === "close") this.onclose = handler as (ev: { code: number; reason: string }) => void;
  }

  send(_data: string) {}

  simulateOpen() {
    this.readyState = 1;
    this.onopen?.();
  }

  simulateClose(code = 1006, reason = "abnormal") {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }
}

describe("FluxyRoomConnection reconnect + history", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("replays history over REST after reconnect when WS replay did not arrive", async () => {
    const messages = [
      { id: 1, roomId: "lobby", userId: "a", content: "hi", createdAt: "2026-01-01T00:00:00.000Z" },
    ];
    const fetchMessages = vi.fn().mockResolvedValue(messages);
    const client = {
      userId: "alice",
      connect: vi.fn(() => new MockWebSocket("ws://test") as unknown as WebSocket),
      fetchMessages,
    } as unknown as FluxyChatClient;

    const historyEvents: unknown[] = [];
    const conn = new FluxyRoomConnection(client, "lobby", {
      maxReconnectAttempts: 2,
      baseBackoffMs: 10,
      maxBackoffMs: 10,
      historyLimit: 50,
      replayHistoryOnReconnect: true,
      wsReplay: "off",
      heartbeatIntervalMs: 0,
    });

    conn.addEventListener("message", (ev) => {
      if (ev.type === "history") historyEvents.push(ev);
    });

    conn.connect();
    MockWebSocket.instances[0]?.simulateOpen();
    MockWebSocket.instances[0]?.simulateClose();

    await vi.advanceTimersByTimeAsync(15);
    MockWebSocket.instances[1]?.simulateOpen();

    await vi.advanceTimersByTimeAsync(0);

    conn.close();

    expect(fetchMessages).toHaveBeenCalledWith("lobby", { limit: 50 });
    expect(historyEvents.length).toBeGreaterThanOrEqual(1);
  });
});
