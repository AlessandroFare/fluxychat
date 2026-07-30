import { describe, expect, it, vi } from "vitest";
import { isServerRealtimeEvent, onServerEvent } from "./server-realtime";

describe("server-realtime", () => {
  it("detects server_event frames", () => {
    expect(
      isServerRealtimeEvent({
        type: "server_event",
        roomId: "room-1",
        name: "game.tick",
        data: { tick: 3 },
      }),
    ).toBe(true);
    expect(isServerRealtimeEvent({ type: "message" })).toBe(false);
  });

  it("onServerEvent invokes handler for matching frames", () => {
    const ws = new EventTarget() as WebSocket;
    const handler = vi.fn();
    onServerEvent(ws, handler);
    ws.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({
          type: "server_event",
          roomId: "r1",
          name: "iot.reading",
          data: { value: 22 },
        }),
      }),
    );
    expect(handler).toHaveBeenCalledWith({
      roomId: "r1",
      name: "iot.reading",
      data: { value: 22 },
      userId: undefined,
    });
  });
});
