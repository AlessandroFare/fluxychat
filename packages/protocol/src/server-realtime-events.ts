import { isRecord } from "./index.js";

/** Worker → client vertical/labs envelope on room WebSocket. */
export interface ServerRealtimeEventFrame {
  type: "server_event";
  roomId: string;
  name: string;
  data: Record<string, unknown>;
  userId?: string;
}

export function isValidServerRealtimeEventFrame(value: unknown): value is ServerRealtimeEventFrame {
  if (!isRecord(value) || value.type !== "server_event") return false;
  if (typeof value.roomId !== "string" || !value.roomId.trim()) return false;
  if (typeof value.name !== "string" || !value.name.trim()) return false;
  if (!isRecord(value.data)) return false;
  if (value.userId !== undefined && typeof value.userId !== "string") return false;
  return true;
}

/** Normalize announce body from Worker fan-out or Room DO broadcast. */
export function parseServerRealtimeEventFrame(raw: unknown): ServerRealtimeEventFrame | null {
  if (!isValidServerRealtimeEventFrame(raw)) return null;
  return {
    type: "server_event",
    roomId: raw.roomId.trim(),
    name: raw.name.trim(),
    data: raw.data,
    ...(raw.userId ? { userId: raw.userId } : {}),
  };
}
