import { computeReconnectBackoffMs } from "./errors";
import type { FluxyRoomConnectionStatus } from "./room-connection";

/** Transport used by {@link useChat} when WebSocket is unavailable. */
export type FluxyChatTransport = "websocket" | "sse" | "polling" | "none";

/** Portal-style terminal refusal (auth / membership). */
export type FluxyConnectionBlockedStatus = "blocked";

/** WebSocket reconnecting with reduced guarantees (Portal `degraded`). */
export type FluxyConnectionDegradedStatus = "degraded" | "degraded-http";

/** @deprecated Use `degraded-http` — transport still exposed via {@link FluxyConnectionState.transport}. */
export type FluxyConnectionLegacyFallbackStatus = "polling" | "sse";

/** Unified connection view for UI copy (e.g. "Reconnecting in 3s…"). */
export type FluxyConnectionStateStatus =
  | FluxyRoomConnectionStatus
  | FluxyConnectionBlockedStatus
  | FluxyConnectionDegradedStatus
  | FluxyConnectionLegacyFallbackStatus;

export interface FluxyConnectionState {
  status: FluxyConnectionStateStatus;
  lastError: Error | null;
  /** Current reconnect attempt (0 when connected). */
  retryAttempt: number;
  /** ISO timestamp for the next reconnect try, if scheduled. */
  nextRetryAt: string | null;
  transport: FluxyChatTransport;
  /** Portal-style: REST/send still works while realtime is degraded-http. */
  canPublishViaHttp: boolean;
}

export interface BuildFluxyConnectionStateInput {
  status: FluxyConnectionStateStatus;
  lastError?: Error | null;
  retryAttempt?: number;
  /** When status is `reconnecting`, pass delay until the next socket open. */
  reconnectDelayMs?: number | null;
  transport?: FluxyChatTransport;
  /** When degraded-http and JWT/API key present, HTTP publish remains available. */
  canPublishViaHttp?: boolean;
  /** Defaults to `Date.now()` — inject in tests. */
  nowMs?: number;
}

/** Normalize legacy `sse` / `polling` statuses to Portal-style `degraded-http`. */
export function normalizeConnectionStateStatus(
  status: FluxyConnectionStateStatus,
): FluxyConnectionStateStatus {
  if (status === "sse" || status === "polling") return "degraded-http";
  return status;
}

export function isDegradedConnectionStatus(status: FluxyConnectionStateStatus): boolean {
  const normalized = normalizeConnectionStateStatus(status);
  return normalized === "degraded" || normalized === "degraded-http";
}

export function isBlockedConnectionStatus(status: FluxyConnectionStateStatus): boolean {
  return status === "blocked";
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

  const status = normalizeConnectionStateStatus(input.status);

  return {
    status,
    lastError: input.lastError ?? null,
    retryAttempt,
    nextRetryAt,
    transport: input.transport ?? transportFromStatus(input.status, status),
    canPublishViaHttp: input.canPublishViaHttp ?? false,
  };
}

function transportFromStatus(
  rawStatus: FluxyConnectionStateStatus,
  normalizedStatus: FluxyConnectionStateStatus,
): FluxyChatTransport {
  if (rawStatus === "sse" || normalizedStatus === "degraded-http") {
    if (rawStatus === "polling") return "polling";
    if (rawStatus === "sse") return "sse";
  }
  if (normalizedStatus === "degraded-http") return "polling";
  if (normalizedStatus === "connected" || normalizedStatus === "connecting" || normalizedStatus === "reconnecting" || normalizedStatus === "degraded") {
    return "websocket";
  }
  return "none";
}

export interface ConnectionStatusLabelOptions {
  /** Include SSE/polling hint when status is degraded-http. */
  includeTransport?: boolean;
  /** ISO timestamp for reconnect countdown copy. */
  nextRetryAt?: string | null;
  nowMs?: number;
}

/** Portal-style user-facing label for connection UI and docs. */
export function getConnectionStatusLabel(
  status: FluxyConnectionStateStatus,
  options: ConnectionStatusLabelOptions = {},
): string {
  const normalized = normalizeConnectionStateStatus(status);

  if (normalized === "connected") return "Connected";
  if (normalized === "connecting") return "Connecting…";
  if (normalized === "disconnected") return "Disconnected";
  if (normalized === "blocked") return "Connection blocked";

  if (normalized === "reconnecting") {
    if (options.nextRetryAt) {
      const nowMs = options.nowMs ?? Date.now();
      const sec = Math.ceil((new Date(options.nextRetryAt).getTime() - nowMs) / 1000);
      if (sec > 0) return `Reconnecting in ${sec}s…`;
    }
    return "Reconnecting…";
  }

  if (normalized === "degraded") return "Degraded — realtime limited";

  if (normalized === "degraded-http") {
    if (options.includeTransport) {
      if (status === "sse") return "Degraded — live via SSE";
      if (status === "polling") return "Degraded — live via polling";
    }
    return "Degraded — HTTP fallback active";
  }

  return String(normalized);
}

