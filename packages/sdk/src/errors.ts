/** Worker closes unauthorized / forbidden WebSocket joins with 1008. */
export const FLUXY_WS_CLOSE_POLICY = 1008;

/** Normal client-initiated close. */
export const FLUXY_WS_CLOSE_NORMAL = 1000;

export class FluxyAuthError extends Error {
  readonly code = FLUXY_WS_CLOSE_POLICY;

  constructor(
    message = "Authentication or room access failed (WebSocket close 1008). Check your JWT, API key, and room membership.",
  ) {
    super(message);
    this.name = "FluxyAuthError";
  }
}

export class FluxyConnectionError extends Error {
  readonly code: number;
  readonly reason: string;

  constructor(code: number, reason = "", message?: string) {
    super(message ?? `WebSocket closed unexpectedly (code ${code}${reason ? `: ${reason}` : ""}).`);
    this.name = "FluxyConnectionError";
    this.code = code;
    this.reason = reason;
  }
}

export class FluxySendError extends Error {
  constructor(message = "Cannot send: WebSocket is not open.") {
    super(message);
    this.name = "FluxySendError";
  }
}

export class FluxyTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Operation timed out after ${timeoutMs}ms`);
    this.name = "FluxyTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export function mapWebSocketCloseToError(code: number, reason = ""): Error | null {
  if (code === FLUXY_WS_CLOSE_NORMAL) return null;
  if (code === FLUXY_WS_CLOSE_POLICY) {
    const text = reason.trim();
    if (text.toLowerCase().includes("forbidden")) {
      return new FluxyAuthError(
        "You are not a member of this room (WebSocket close 1008 Forbidden). Join the room or use an admin JWT.",
      );
    }
    return new FluxyAuthError();
  }
  return new FluxyConnectionError(code, reason);
}

export function computeReconnectBackoffMs(
  attempt: number,
  baseMs = 500,
  maxMs = 20_000,
): number {
  const capped = Math.min(Math.max(attempt, 0), 6);
  return Math.min(maxMs, baseMs * 2 ** capped);
}
