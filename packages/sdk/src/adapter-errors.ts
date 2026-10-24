/**
 * P26-A-4: Standardized adapter error hierarchy.
 *
 * Port of `apps/worker/src/lib/errors.js` so the public guide
 * (`/docs/guides/adapter-errors`) works against `@fluxy-chat/sdk`:
 * every error carries `adapter` and a machine-readable `code`; subclasses
 * add structured fields (`retryAfter`, `requiredScope`, ...).
 */

import { FluxyChatError } from "./structured-errors";

/** Base error class for adapter operations. All adapter-specific errors extend this class. */
export class AdapterError extends FluxyChatError {
  readonly adapter: string;

  constructor(message: string, adapter: string, code = "ADAPTER_ERROR") {
    super(code, message);
    this.name = "AdapterError";
    this.adapter = adapter;
  }
}

/** Thrown when platform API rate limits are hit. Includes `retryAfter` (seconds) for backoff. */
export class AdapterRateLimitError extends AdapterError {
  readonly retryAfter: number | undefined;

  constructor(adapter: string, retryAfter?: number) {
    super(
      `Rate limited by ${adapter}${retryAfter ? `, retry after ${retryAfter}s` : ""}`,
      adapter,
      "RATE_LIMITED",
    );
    this.name = "AdapterRateLimitError";
    this.retryAfter = retryAfter;
  }
}

/** Thrown when credentials are invalid or expired. */
export class AuthenticationError extends AdapterError {
  constructor(adapter: string, message?: string) {
    super(message ?? `Authentication failed for ${adapter}`, adapter, "AUTH_FAILED");
    this.name = "AuthenticationError";
  }
}

/** Thrown when a requested resource doesn't exist. */
export class ResourceNotFoundError extends AdapterError {
  readonly resourceType: string;
  readonly resourceId: string | undefined;

  constructor(adapter: string, resourceType: string, resourceId?: string) {
    super(
      `${resourceType}${resourceId ? ` '${resourceId}'` : ""} not found in ${adapter}`,
      adapter,
      "NOT_FOUND",
    );
    this.name = "ResourceNotFoundError";
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}

/** Thrown when the bot lacks required permissions. Includes `action` and `requiredScope`. */
export class PermissionError extends AdapterError {
  readonly action: string;
  readonly requiredScope: string | undefined;

  constructor(adapter: string, action: string, requiredScope?: string) {
    super(
      `Permission denied: cannot ${action} in ${adapter}${requiredScope ? ` (requires: ${requiredScope})` : ""}`,
      adapter,
      "PERMISSION_DENIED",
    );
    this.name = "PermissionError";
    this.action = action;
    this.requiredScope = requiredScope;
  }
}

/** Thrown when input data is invalid. */
export class ValidationError extends AdapterError {
  constructor(adapter: string, message: string) {
    super(message, adapter, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

/** Thrown when there's a network/connectivity issue. Includes `originalError` for debugging. */
export class NetworkError extends AdapterError {
  readonly originalError: Error | undefined;

  constructor(adapter: string, message?: string, originalError?: Error) {
    super(message ?? `Network error communicating with ${adapter}`, adapter, "NETWORK_ERROR");
    this.name = "NetworkError";
    this.originalError = originalError;
  }
}

/** Thrown when an adapter slug doesn't match any registered adapter. */
export class AdapterNotFoundError extends AdapterError {
  constructor(slug: string) {
    super(`Adapter "${slug}" not found`, slug, "ADAPTER_NOT_FOUND");
    this.name = "AdapterNotFoundError";
  }
}

/** Thrown when a thread doesn't exist. */
export class ThreadNotFoundError extends AdapterError {
  readonly threadId: string;

  constructor(adapter: string, threadId: string) {
    super(`Thread '${threadId}' not found in ${adapter}`, adapter, "THREAD_NOT_FOUND");
    this.name = "ThreadNotFoundError";
    this.threadId = threadId;
  }
}

/** Thrown when a message doesn't exist. */
export class MessageNotFoundError extends AdapterError {
  readonly messageId: string;

  constructor(adapter: string, messageId: string) {
    super(`Message '${messageId}' not found in ${adapter}`, adapter, "MESSAGE_NOT_FOUND");
    this.name = "MessageNotFoundError";
    this.messageId = messageId;
  }
}
