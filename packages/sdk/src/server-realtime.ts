/** Worker → room WebSocket envelope for vertical/labs events (game, IoT, live, fleet, polls). */
export interface ServerRealtimeEvent {
  type: "server_event";
  roomId: string;
  name: string;
  data: Record<string, unknown>;
  userId?: string;
}

export function isServerRealtimeEvent(value: unknown): value is ServerRealtimeEvent {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.type === "server_event" &&
    typeof v.roomId === "string" &&
    typeof v.name === "string" &&
    v.data != null &&
    typeof v.data === "object"
  );
}

export type ServerEventHandler = (event: Omit<ServerRealtimeEvent, "type">) => void;

/** Subscribe to typed server_event frames on a room WebSocket. */
export function onServerEvent(ws: WebSocket, handler: ServerEventHandler): () => void {
  const listener = (ev: MessageEvent) => {
    try {
      const data = JSON.parse(String(ev.data)) as unknown;
      if (!isServerRealtimeEvent(data)) return;
      handler({
        roomId: data.roomId,
        name: data.name,
        data: data.data as Record<string, unknown>,
        userId: data.userId,
      });
    } catch {
      /* ignore */
    }
  };
  ws.addEventListener("message", listener);
  return () => ws.removeEventListener("message", listener);
}
