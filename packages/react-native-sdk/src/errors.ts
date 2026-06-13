export class FluxyAuthError extends Error {
  readonly code = 1008;
  constructor(message = 'Authentication or room access failed (WebSocket close 1008).') {
    super(message);
    this.name = 'FluxyAuthError';
  }
}

export class FluxyConnectionError extends Error {
  readonly code: number;
  readonly reason: string;
  constructor(code: number, reason = '', message?: string) {
    super(message ?? `WebSocket closed unexpectedly (code ${code}${reason ? `: ${reason}` : ''}).`);
    this.name = 'FluxyConnectionError';
    this.code = code;
    this.reason = reason;
  }
}

export class FluxySendError extends Error {
  constructor(message = 'Cannot send: WebSocket is not open.') {
    super(message);
    this.name = 'FluxySendError';
  }
}

export class FluxyTimeoutError extends Error {
  readonly timeoutMs: number;
  constructor(timeoutMs: number) {
    super(`Operation timed out after ${timeoutMs}ms`);
    this.name = 'FluxyTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export const FLUXY_WS_CLOSE_NORMAL = 1000;
export const FLUXY_WS_CLOSE_POLICY = 1008;

export function mapWebSocketCloseToError(code: number, reason = ''): Error | null {
  if (code === FLUXY_WS_CLOSE_NORMAL) return null;
  if (code === FLUXY_WS_CLOSE_POLICY) return new FluxyAuthError();
  return new FluxyConnectionError(code, reason);
}

export function computeReconnectBackoffMs(attempt: number, baseMs = 500, maxMs = 20_000): number {
  const capped = Math.min(Math.max(attempt, 0), 6);
  return Math.min(maxMs, baseMs * 2 ** capped);
}
