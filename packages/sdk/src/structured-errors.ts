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

/**
 * A gate refused the send (Portal `BlockedError`). Branch on `reason` (e.g. `thread_depth_exceeded`).
 */
export class FluxyBlockedError extends ChatError {
  readonly reason: string;

  constructor(reason: string, message?: string) {
    super("blocked", message ?? reason);
    this.name = "FluxyBlockedError";
    this.reason = reason;
  }
}

export class ThreadDepthExceededError extends FluxyBlockedError {
  constructor(message?: string) {
    super("thread_depth_exceeded", message ?? "Reply thread is too deep.");
    this.name = "ThreadDepthExceededError";
  }
}
