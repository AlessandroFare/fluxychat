import { describe, expect, it, vi } from "vitest";
import type { FluxyChatEvent } from "./index";
import type { FluxyChatRoomConnection } from "./room-connection";
import { FluxyMessageStream } from "./message-stream";

function mockConnection() {
  const sends: Record<string, unknown>[] = [];
  const listeners: Array<(event: FluxyChatEvent) => void> = [];

  const connection = {
    sendJson(payload: Record<string, unknown>) {
      sends.push(payload);
      if (payload.op === "start") {
        for (const listener of listeners) {
          listener({ type: "stream", op: "started", id: 42, roomId: "room-a" });
        }
      }
    },
    addEventListener(_type: "message", listener: (event: FluxyChatEvent) => void) {
      listeners.push(listener);
    },
    removeEventListener() {
      /* noop */
    },
  } as unknown as FluxyChatRoomConnection;

  return { connection, sends };
}

describe("FluxyMessageStream", () => {
  it("emits stream start on first push", () => {
    const { connection, sends } = mockConnection();
    const stream = new FluxyMessageStream(connection, "agent-1");
    stream.push("Hello");
    expect(sends[0]).toMatchObject({
      type: "stream",
      op: "start",
      userId: "agent-1",
      content: "Hello",
    });
    expect(stream.activeMessageId).toBe(42);
  });

  it("ends with stream end frame", async () => {
    vi.useFakeTimers();
    const { connection, sends } = mockConnection();
    const stream = new FluxyMessageStream(connection, "agent-1", { flushIntervalMs: 50 });
    stream.push("Hi");
    vi.advanceTimersByTime(60);
    await Promise.resolve();
    stream.end();
    await vi.waitFor(() =>
      expect(sends.some((p) => p.type === "stream" && p.op === "end")).toBe(true),
    );
    vi.useRealTimers();
  });
});
