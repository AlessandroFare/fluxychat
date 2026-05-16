import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FluxyChatClient } from "./index";
import { FluxyTimeoutError } from "./errors";

type WsHandler = (event?: { data?: string }) => void;

describe("FluxyChatRoomConnection.waitFor", () => {
  let instances: MockWebSocket[] = [];

  class MockWebSocket {
    static OPEN = 1;
    readyState = MockWebSocket.OPEN;
    private listeners: Record<string, WsHandler[]> = {};

    constructor(_url: string) {
      instances.push(this);
      queueMicrotask(() => this.emit("open"));
    }

    addEventListener(type: string, handler: WsHandler) {
      (this.listeners[type] ||= []).push(handler);
    }

    emit(type: string, event?: { data?: string }) {
      for (const handler of this.listeners[type] || []) {
        handler(event);
      }
    }

    close() {
      this.emit("close", { code: 1000 });
    }

    send() {
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

  it("resolves when a matching message arrives", async () => {
    const client = new FluxyChatClient({ baseUrl: "http://127.0.0.1:8787", userId: "agent-1", token: "jwt" });
    const conn = client.connectRoom("room-a");
    conn.connect();
    await vi.waitFor(() => expect(conn.connectionStatus).toBe("connected"));

    const waitPromise = conn.waitFor(
      (event) => event.type === "message" && event.content.includes("pong"),
      { timeout: 2000 },
    );

    instances[0]!.emit("message", {
      data: JSON.stringify({
        type: "message",
        id: 9,
        roomId: "room-a",
        userId: "user-2",
        content: "pong!",
        createdAt: new Date().toISOString(),
      }),
    });

    const msg = await waitPromise;
    expect(msg.content).toBe("pong!");
  });

  it("rejects on timeout", async () => {
    vi.useFakeTimers();
    const client = new FluxyChatClient({ baseUrl: "http://127.0.0.1:8787", userId: "u", token: "jwt" });
    const conn = client.connectRoom("room-a");
    conn.connect();
    await vi.waitFor(() => expect(conn.connectionStatus).toBe("connected"));

    const waitPromise = conn.waitFor(() => false, { timeout: 500 });
    vi.advanceTimersByTime(600);
    await expect(waitPromise).rejects.toBeInstanceOf(FluxyTimeoutError);
    vi.useRealTimers();
  });
});
