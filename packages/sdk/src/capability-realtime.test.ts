import { describe, expect, it, vi } from "vitest";
import { isCapabilityRealtimeEvent, onCapabilityEvent } from "./capability-realtime";

describe("capability-realtime", () => {
  it("detects capability_event frames", () => {
    expect(
      isCapabilityRealtimeEvent({
        type: "capability_event",
        roomId: "lobby",
        event: { eventId: "evt_1", type: "edu.poll.created" },
      }),
    ).toBe(true);
    expect(isCapabilityRealtimeEvent({ type: "message" })).toBe(false);
  });

  it("invokes handler on matching websocket message", () => {
    const handler = vi.fn();
    const listeners = new Map<string, (ev: MessageEvent) => void>();
    const ws = {
      addEventListener: (type: string, fn: (ev: MessageEvent) => void) => {
        listeners.set(type, fn);
      },
      removeEventListener: (type: string) => {
        listeners.delete(type);
      },
    } as unknown as WebSocket;

    const off = onCapabilityEvent(ws, handler);
    listeners.get("message")?.({
      data: JSON.stringify({
        type: "capability_event",
        roomId: "lobby",
        event: { eventId: "evt_2", type: "attendance.heartbeat" },
      }),
    } as MessageEvent);

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: "evt_2" }),
    );
    off();
  });
});
