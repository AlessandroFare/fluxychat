/**
 * P22-F9: Structured error types for chat operations.
 * Provides typed errors that clients can handle specifically.
 */

export class ChatError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ChatError";
    this.code = code;
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

export class LockError extends ChatError {
  constructor(message?: string) {
    super("LOCK_ACQUISITION_FAILED", message ?? "Failed to acquire thread lock.");
    this.name = "LockError";
  }
}

export class NotImplementedError extends ChatError {
  constructor(feature: string) {
    super("NOT_IMPLEMENTED", `Feature not implemented: ${feature}`);
    this.name = "NotImplementedError";
  }
}
