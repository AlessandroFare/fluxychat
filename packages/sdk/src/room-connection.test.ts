import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FluxyChatClient } from "./index";
import { FluxyAuthError, FluxySendError, FLUXY_WS_CLOSE_POLICY } from "./errors";
import { FLUXY_WS_CLOSE_HEARTBEAT } from "./room-connection";

type WsHandler = (event?: { code?: number; reason?: string; data?: string }) => void;

describe("FluxyChatRoomConnection", () => {
  const baseUrl = "http://127.0.0.1:8787";
  let instances: MockWebSocket[] = [];

  class MockWebSocket {
    static OPEN = 1;
    static CLOSED = 3;
    readyState = MockWebSocket.OPEN;
    url: string;
    sent: string[] = [];
    private listeners: Record<string, WsHandler[]> = {};

    constructor(url: string) {
      this.url = url;
      instances.push(this);
      queueMicrotask(() => this.emit("open"));
    }

    addEventListener(type: string, handler: WsHandler) {
      (this.listeners[type] ||= []).push(handler);
    }

    emit(type: string, event?: { code?: number; reason?: string; data?: string }) {
      for (const handler of this.listeners[type] || []) {
        handler(event);
      }
    }

    close(code?: number, reason?: string) {
      this.readyState = MockWebSocket.CLOSED;
      this.emit("close", { code: code ?? 1000, reason: reason ?? "" });
    }

    send(data: string) {
      this.sent.push(data);
    }
  }

  beforeEach(() => {
    instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ messages: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("stops reconnecting on auth close 1008", async () => {
    const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
    const onAuthError = vi.fn();
    const onReconnectFailed = vi.fn();

    const conn = client.connectRoom("room-a", {
      maxReconnectAttempts: 5,
      onAuthError,
      onReconnectFailed,
    });
    conn.connect();

    await vi.waitFor(() => expect(instances.length).toBe(1));
    conn.sendJson({ type: "typing", userId: "u", isTyping: true });
    expect(conn.getOutboundQueueDepth()).toBe(0);

    instances[0]!.emit("close", { code: FLUXY_WS_CLOSE_POLICY, reason: "Unauthorized" });

    await vi.waitFor(() => expect(onAuthError).toHaveBeenCalledTimes(1));
    expect(onAuthError.mock.calls[0]?.[0]).toBeInstanceOf(FluxyAuthError);
    expect(onReconnectFailed).not.toHaveBeenCalled();
    expect(instances.length).toBe(1);
    expect(conn.connectionStatus).toBe("disconnected");
    expect(conn.getOutboundQueueDepth()).toBe(0);
  });

  it("queues outbound frames while reconnecting and flushes on open", async () => {
    vi.useFakeTimers();

    const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
    const conn = client.connectRoom("room-q", {
      maxReconnectAttempts: 3,
      baseBackoffMs: 100,
      maxBackoffMs: 100,
      replayHistoryOnReconnect: false,
      heartbeatIntervalMs: 0,
    });
    conn.connect();

    await vi.waitFor(() => expect(instances.length).toBe(1));
    const first = instances[0]!;
    expect(first.sent.some((s) => s.includes('"type":"ping"'))).toBe(false);

    first.emit("close", { code: 1006, reason: "gone" });
    await vi.waitFor(() => expect(conn.connectionStatus).toBe("reconnecting"));

    conn.sendJson({ type: "typing", userId: "u", isTyping: true });
    expect(conn.getOutboundQueueDepth()).toBe(1);

    await vi.advanceTimersByTimeAsync(100);
    await vi.waitFor(() => expect(instances.length).toBe(2));

    const second = instances[1]!;
    await vi.waitFor(() => expect(conn.connectionStatus).toBe("connected"));
    expect(
      second.sent.some((s) => s.includes('"type":"typing"') && s.includes('"isTyping":true')),
    ).toBe(true);
    expect(conn.getOutboundQueueDepth()).toBe(0);

    vi.useRealTimers();
  });

  it("throws when sending while disconnected without connect", () => {
    const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
    const conn = client.connectRoom("room-idle", { heartbeatIntervalMs: 0 });
    expect(() => conn.sendJson({ type: "ping" })).toThrow(FluxySendError);
  });

  it("sends heartbeat ping and ignores pong without delivering to listeners", async () => {
    vi.useFakeTimers();

    const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
    const onMessage = vi.fn();
    const conn = client.connectRoom("room-hb", {
      heartbeatIntervalMs: 25_000,
      heartbeatTimeoutMs: 60_000,
      replayHistoryOnReconnect: false,
    });
    conn.addEventListener("message", onMessage);
    conn.connect();

    await vi.waitFor(() => expect(instances.length).toBe(1));
    const ws = instances[0]!;

    await vi.advanceTimersByTimeAsync(25_000);
    expect(ws.sent.some((s) => s === JSON.stringify({ type: "ping" }))).toBe(true);

    ws.emit("message", { data: JSON.stringify({ type: "pong", ts: Date.now() }) });
    expect(onMessage).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("closes socket when heartbeat times out", async () => {
    vi.useFakeTimers();

    const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
    const conn = client.connectRoom("room-hb-timeout", {
      maxReconnectAttempts: 1,
      baseBackoffMs: 50,
      maxBackoffMs: 50,
      heartbeatIntervalMs: 10_000,
      heartbeatTimeoutMs: 20_000,
      replayHistoryOnReconnect: false,
    });
    conn.connect();

    await vi.waitFor(() => expect(instances.length).toBe(1));
    const ws = instances[0]!;
    const closeSpy = vi.spyOn(ws, "close");

    await vi.advanceTimersByTimeAsync(30_000);
    expect(closeSpy).toHaveBeenCalledWith(FLUXY_WS_CLOSE_HEARTBEAT, "heartbeat_timeout");

    vi.useRealTimers();
  });

  it("drops oldest frame when outbound queue exceeds cap", async () => {
    vi.useFakeTimers();

    const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
    const onDrop = vi.fn();
    const conn = client.connectRoom("room-cap", {
      maxOutboundQueue: 2,
      maxOutboundQueueAgeMs: 60_000,
      heartbeatIntervalMs: 0,
      replayHistoryOnReconnect: false,
      maxReconnectAttempts: 2,
      baseBackoffMs: 100,
      onOutboundQueueDrop: onDrop,
    });
    conn.connect();

    await vi.waitFor(() => expect(instances.length).toBe(1));
    instances[0]!.emit("close", { code: 1006, reason: "gone" });
    await vi.waitFor(() => expect(conn.connectionStatus).toBe("reconnecting"));

    conn.sendJson({ type: "a", n: 1 });
    conn.sendJson({ type: "b", n: 2 });
    conn.sendJson({ type: "c", n: 3 });

    expect(conn.getOutboundQueueDepth()).toBe(2);
    expect(onDrop).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("skips REST history replay when WS replay snapshot arrives on reconnect", async () => {
    vi.useFakeTimers();
    const fetchMessages = vi
      .spyOn(FluxyChatClient.prototype, "fetchMessages")
      .mockResolvedValue([]);

    let socketCount = 0;
    class ReconnectMockWebSocket {
      static OPEN = 1;
      static CLOSED = 3;
      readyState = ReconnectMockWebSocket.OPEN;
      url: string;
      sent: string[] = [];
      private listeners: Record<string, WsHandler[]> = {};

      constructor(url: string) {
        this.url = url;
        instances.push(this);
        socketCount += 1;
        if (socketCount === 1) {
          queueMicrotask(() => this.emit("open"));
        }
      }

      addEventListener(type: string, handler: WsHandler) {
        (this.listeners[type] ||= []).push(handler);
      }

      emit(type: string, event?: { code?: number; reason?: string; data?: string }) {
        for (const handler of this.listeners[type] || []) {
          handler(event);
        }
      }

      close(code?: number, reason?: string) {
        this.readyState = ReconnectMockWebSocket.CLOSED;
        this.emit("close", { code: code ?? 1000, reason: reason ?? "" });
      }

      send(data: string) {
        this.sent.push(data);
      }
    }
    vi.stubGlobal("WebSocket", ReconnectMockWebSocket as unknown as typeof WebSocket);

    const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
    const conn = client.connectRoom("room-replay", {
      maxReconnectAttempts: 3,
      baseBackoffMs: 50,
      maxBackoffMs: 50,
      replayHistoryOnReconnect: true,
      heartbeatIntervalMs: 0,
    });
    conn.connect();

    await vi.waitFor(() => expect(instances.length).toBe(1));
    instances[0]!.emit("close", { code: 1006, reason: "gone" });
    await vi.advanceTimersByTimeAsync(50);
    await vi.waitFor(() => expect(instances.length).toBe(2));

    instances[1]!.emit("message", {
      data: JSON.stringify({
        type: "replay",
        messages: [
          {
            id: 1,
            roomId: "room-replay",
            userId: "u",
            content: "hi",
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    });
    instances[1]!.emit("open");
    await Promise.resolve();
    expect(fetchMessages).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("onAnyEvent receives all events including state_change", async () => {
    const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
    const onAny = vi.fn();
    const onTyped = vi.fn();
    const conn = client.connectRoom("room-any", {
      heartbeatIntervalMs: 0,
      replayHistoryOnReconnect: false,
    });
    conn.onAnyEvent(onAny);
    conn.addEventListener("message", onTyped);
    conn.connect();

    await vi.waitFor(() => expect(instances.length).toBe(1));
    const ws = instances[0]!;
    ws.emit("open", {});

    await vi.waitFor(() =>
      expect(onAny.mock.calls.some((c) => c[0]?.type === "state_change")).toBe(true),
    );

    ws.emit("message", {
      data: JSON.stringify({ type: "typing", userId: "other", isTyping: true }),
    });
    expect(onAny).toHaveBeenCalledWith(
      expect.objectContaining({ type: "typing", userId: "other" }),
    );
    expect(onTyped).toHaveBeenCalledWith(
      expect.objectContaining({ type: "typing", userId: "other" }),
    );
  });
});
