/**
 * P22-F9 / DX-10.1: Structured error types for chat operations.
 * Base {@link FluxyChatError} + machine-readable `code` on every subclass.
 */

export class FluxyChatError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "FluxyChatError";
    this.code = code;
  }
}

export function isFluxyChatError(error: unknown): error is FluxyChatError {
  return error instanceof FluxyChatError;
}

export class ChatError extends FluxyChatError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "ChatError";
  }
}

export class RateLimitError extends ChatError {
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number, message?: string) {
    super("RATE_LIMITED", message ?? `Rate limited. Retry after ${retryAfterMs}ms.`);
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

/** Portal-style alias — same class as {@link RateLimitError}. */
export class FluxyRateLimitError extends RateLimitError {
  constructor(retryAfterMs: number, message?: string) {
    super(retryAfterMs, message);
    this.name = "FluxyRateLimitError";
  }
}

export class LockError extends ChatError {
  constructor(message?: string) {
    super("LOCK_ACQUISITION_FAILED", message ?? "Failed to acquire thread lock.");
    this.name = "LockError";
  }
}

/** Portal-style alias — same class as {@link LockError}. */
export class FluxyLockError extends LockError {
  constructor(message?: string) {
    super(message);
    this.name = "FluxyLockError";
  }
}

export class NotImplementedError extends ChatError {
  constructor(feature: string) {
    super("NOT_IMPLEMENTED", `Feature not implemented: ${feature}`);
    this.name = "NotImplementedError";
  }
}

/** Portal-style alias — same class as {@link NotImplementedError}. */
export class FluxyNotImplementedError extends NotImplementedError {
  constructor(feature: string) {
    super(feature);
    this.name = "FluxyNotImplementedError";
  }
}
