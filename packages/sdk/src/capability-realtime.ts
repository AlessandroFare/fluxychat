import type { RoomEvent } from "./vertical-platform";

export interface CapabilityRealtimeEvent {
  type: "capability_event";
  roomId: string;
  event: RoomEvent;
}

export function isCapabilityRealtimeEvent(value: unknown): value is CapabilityRealtimeEvent {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.type === "capability_event" && typeof v.roomId === "string" && !!v.event;
}

/** Subscribe to live capability events on a room WebSocket (requires Worker fan-out). */
export function onCapabilityEvent(
  ws: WebSocket,
  handler: (event: RoomEvent) => void,
): () => void {
  const listener = (ev: MessageEvent) => {
    try {
      const data = JSON.parse(String(ev.data)) as unknown;
      if (isCapabilityRealtimeEvent(data)) handler(data.event);
    } catch {
      /* ignore */
    }
  };
  ws.addEventListener("message", listener);
  return () => ws.removeEventListener("message", listener);
}
