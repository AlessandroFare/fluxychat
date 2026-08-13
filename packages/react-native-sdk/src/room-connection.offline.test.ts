import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { FluxyRoomConnection } from "./room-connection";
import { createMemoryRnOutboxStore } from "./offline-queue";
import type { FluxyChatClient } from "./index";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;
  static CLOSED = 3;
  static CONNECTING = 0;
  readyState = 0;
  sent: string[] = [];

  constructor(_url: string) {
    MockWebSocket.instances.push(this);
  }

  addEventListener(type: string, handler: (ev: unknown) => void) {
    if (type === "open") this.onopen = handler as () => void;
    if (type === "message") this.onmessage = handler as (ev: { data: string }) => void;
    if (type === "close") this.onclose = handler as (ev: { code: number; reason: string }) => void;
  }

  send(data: string) {
    this.sent.push(data);
  }

  close(_code?: number, _reason?: string) {
    this.readyState = 3;
    this.onclose?.({ code: 1000, reason: "closed" });
  }

  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: ((ev: { code: number; reason: string }) => void) | null = null;

  simulateOpen() {
    this.readyState = 1;
    this.onopen?.();
  }
}

describe("FluxyRoomConnection persistent outbox (NW-114)", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists sends while disconnected and flushes on reconnect", async () => {
    const client = {
      userId: "alice",
      connect: vi.fn(() => new MockWebSocket("ws://test") as unknown as WebSocket),
      fetchMessages: vi.fn().mockResolvedValue([]),
    } as unknown as FluxyChatClient;

    const store = createMemoryRnOutboxStore();
    const conn = new FluxyRoomConnection(client, "lobby", {
      persistentOutbox: store,
      maxReconnectAttempts: 0,
      heartbeatIntervalMs: 0,
    });

    conn.connect();
    const ws = MockWebSocket.instances[0]!;
    ws.simulateOpen();

    conn.sendJson({ type: "message", userId: "alice", content: "online" });
    expect(ws.sent.length).toBe(1);

    ws.close(1006, "gone");
    expect(conn.connectionStatus).toBe("disconnected");

    conn.sendJson({ type: "message", userId: "alice", content: "offline-msg" });
    await vi.waitFor(async () => {
      expect(await store.pendingCount()).toBe(1);
      expect(conn.getSyncStatus()).toBe("pending");
    });

    conn.connect();
    const ws2 = MockWebSocket.instances[1]!;
    ws2.simulateOpen();

    await vi.waitFor(() => expect(ws2.sent.some((s) => s.includes("offline-msg"))).toBe(true));
    expect(await store.pendingCount()).toBe(0);
    expect(conn.getSyncStatus()).toBe("synced");

    conn.close();
  });
});
