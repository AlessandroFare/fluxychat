import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FluxyChatClient } from "./index";
import { FluxyAuthError } from "./errors";
import { FLUXY_WS_CLOSE_POLICY } from "./errors";

type WsHandler = (event?: { code?: number; reason?: string; data?: string }) => void;

describe("FluxyChatRoomConnection", () => {
  const baseUrl = "http://127.0.0.1:8787";
  let instances: MockWebSocket[] = [];

  class MockWebSocket {
    static OPEN = 1;
    static CLOSED = 3;
    readyState = MockWebSocket.OPEN;
    url: string;
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

    close(code?: number) {
      this.readyState = MockWebSocket.CLOSED;
      this.emit("close", { code: code ?? 1000, reason: "" });
    }

    send(_data: string) {
      /* noop */
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
    instances[0]!.emit("close", { code: FLUXY_WS_CLOSE_POLICY, reason: "Unauthorized" });

    await vi.waitFor(() => expect(onAuthError).toHaveBeenCalledTimes(1));
    expect(onAuthError.mock.calls[0]?.[0]).toBeInstanceOf(FluxyAuthError);
    expect(onReconnectFailed).not.toHaveBeenCalled();
    expect(instances.length).toBe(1);
    expect(conn.connectionStatus).toBe("disconnected");
  });
});
