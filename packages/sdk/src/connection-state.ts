import { computeReconnectBackoffMs } from "./errors";
import type { FluxyRoomConnectionStatus } from "./room-connection";

/** Transport used by {@link useChat} when WebSocket is unavailable. */
export type FluxyChatTransport = "websocket" | "sse" | "polling" | "none";

/** Unified connection view for UI copy (e.g. "Reconnecting in 3s…"). */
export type FluxyConnectionStateStatus =
  | FluxyRoomConnectionStatus
  | "polling"
  | "sse";

export interface FluxyConnectionState {
  status: FluxyConnectionStateStatus;
  lastError: Error | null;
  /** Current reconnect attempt (0 when connected). */
  retryAttempt: number;
  /** ISO timestamp for the next reconnect try, if scheduled. */
  nextRetryAt: string | null;
  transport: FluxyChatTransport;
}

export interface BuildFluxyConnectionStateInput {
  status: FluxyConnectionStateStatus;
  lastError?: Error | null;
  retryAttempt?: number;
  /** When status is `reconnecting`, pass delay until the next socket open. */
  reconnectDelayMs?: number | null;
  transport?: FluxyChatTransport;
  /** Defaults to `Date.now()` — inject in tests. */
  nowMs?: number;
}

export function buildFluxyConnectionState(
  input: BuildFluxyConnectionStateInput,
): FluxyConnectionState {
  const nowMs = input.nowMs ?? Date.now();
  const retryAttempt = input.retryAttempt ?? 0;
  let nextRetryAt: string | null = null;

  if (input.status === "reconnecting") {
    const delay =
      input.reconnectDelayMs ??
      computeReconnectBackoffMs(Math.max(retryAttempt, 1));
    if (delay > 0) {
      nextRetryAt = new Date(nowMs + delay).toISOString();
    }
  }

  return {
    status: input.status,
    lastError: input.lastError ?? null,
    retryAttempt,
    nextRetryAt,
    transport: input.transport ?? transportFromStatus(input.status),
  };
}

function transportFromStatus(status: FluxyConnectionStateStatus): FluxyChatTransport {
  if (status === "sse") return "sse";
  if (status === "polling") return "polling";
  if (status === "connected" || status === "connecting" || status === "reconnecting") {
    return "websocket";
  }
  return "none";
}
