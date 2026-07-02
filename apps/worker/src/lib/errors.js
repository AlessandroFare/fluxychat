/**
 * P26-A-4: Standardized adapter error hierarchy
 * Adapted from Vercel Chat SDK's adapter-shared/src/errors.ts.
 *
 * Provides consistent error handling across all adapter implementations.
 * Each error has structured fields for programmatic handling:
 *
 * - AdapterRateLimitError: retryAfter field for backoff
 * - PermissionError: requiredScope field for user feedback
 * - AdapterNotFoundError: when adapter slug doesn't match
 * - ThreadNotFoundError: when thread doesn't exist
 * - MessageNotFoundError: when message doesn't exist
 *
 * @example
 * ```js
 * import { AdapterRateLimitError, PermissionError } from "./errors.js";
 *
 * try {
 *   await adapter.postMessage(threadId, text);
 * } catch (err) {
 *   if (err instanceof AdapterRateLimitError) {
 *     await sleep(err.retryAfter * 1000);
 *     retry();
 *   } else if (err instanceof PermissionError) {
 *     showPermissionError(err.requiredScope);
 *   }
 * }
 * ```
 */

// =============================================================================
// Base Error
// =============================================================================

/**
 * Base error class for adapter operations.
 * All adapter-specific errors extend this class.
 */
export class AdapterError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {string} adapter - Adapter name (e.g. "slack", "teams")
   * @param {string} [code] - Error code for programmatic handling
   */
  constructor(message, adapter, code) {
    super(message);
    this.name = "AdapterError";
    this.adapter = adapter;
    this.code = code;
  }
}

// =============================================================================
// Rate Limit Error
// =============================================================================

/**
 * Thrown when platform API rate limits are hit.
 * Includes `retryAfter` (seconds) for backoff.
 *
 * @example
 * ```js
 * throw new AdapterRateLimitError("slack", 30);
 * // message: "Rate limited by slack, retry after 30s"
 * ```
 */
export class AdapterRateLimitError extends AdapterError {
  /** @type {number|undefined} Retry-after in seconds */
  retryAfter;

  constructor(adapter, retryAfter) {
    super(
      `Rate limited by ${adapter}${retryAfter ? `, retry after ${retryAfter}s` : ""}`,
      adapter,
      "RATE_LIMITED"
    );
    this.name = "AdapterRateLimitError";
    this.retryAfter = retryAfter;
  }
}

// =============================================================================
// Authentication Error
// =============================================================================

/**
 * Thrown when credentials are invalid or expired.
 */
export class AuthenticationError extends AdapterError {
  constructor(adapter, message) {
    super(
      message || `Authentication failed for ${adapter}`,
      adapter,
      "AUTH_FAILED"
    );
    this.name = "AuthenticationError";
  }
}

// =============================================================================
// Resource Not Found Error
// =============================================================================

/**
 * Thrown when a requested resource doesn't exist.
 * Includes `resourceType` and `resourceId` for programmatic handling.
 */
export class ResourceNotFoundError extends AdapterError {
  /** @type {string} */
  resourceType;
  /** @type {string|undefined} */
  resourceId;

  constructor(adapter, resourceType, resourceId) {
    const idPart = resourceId ? ` '${resourceId}'` : "";
    super(
      `${resourceType}${idPart} not found in ${adapter}`,
      adapter,
      "NOT_FOUND"
    );
    this.name = "ResourceNotFoundError";
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}

// =============================================================================
// Permission Error
// =============================================================================

/**
 * Thrown when the bot lacks required permissions.
 * Includes `action` and `requiredScope` for user feedback.
 *
 * @example
 * ```js
 * throw new PermissionError("teams", "send messages", "channels:write");
 * ```
 */
export class PermissionError extends AdapterError {
  /** @type {string} */
  action;
  /** @type {string|undefined} */
  requiredScope;

  constructor(adapter, action, requiredScope) {
    const scopePart = requiredScope ? ` (requires: ${requiredScope})` : "";
    super(
      `Permission denied: cannot ${action} in ${adapter}${scopePart}`,
      adapter,
      "PERMISSION_DENIED"
    );
    this.name = "PermissionError";
    this.action = action;
    this.requiredScope = requiredScope;
  }
}

// =============================================================================
// Validation Error
// =============================================================================

/**
 * Thrown when input data is invalid.
 */
export class ValidationError extends AdapterError {
  constructor(adapter, message) {
    super(message, adapter, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

// =============================================================================
// Network Error
// =============================================================================

/**
 * Thrown when there's a network/connectivity issue.
 * Includes `originalError` for debugging.
 */
export class NetworkError extends AdapterError {
  /** @type {Error|undefined} */
  originalError;

  constructor(adapter, message, originalError) {
    super(
      message || `Network error communicating with ${adapter}`,
      adapter,
      "NETWORK_ERROR"
    );
    this.name = "NetworkError";
    this.originalError = originalError;
  }
}

// =============================================================================
// FluxyChat-Specific Errors
// =============================================================================

/**
 * Thrown when an adapter slug doesn't match any registered adapter.
 */
export class AdapterNotFoundError extends AdapterError {
  constructor(slug) {
    super(
      `Adapter "${slug}" not found`,
      slug,
      "ADAPTER_NOT_FOUND"
    );
    this.name = "AdapterNotFoundError";
  }
}

/**
 * Thrown when a thread doesn't exist.
 */
export class ThreadNotFoundError extends AdapterError {
  /** @type {string} */
  threadId;

  constructor(adapter, threadId) {
    super(
      `Thread '${threadId}' not found in ${adapter}`,
      adapter,
      "THREAD_NOT_FOUND"
    );
    this.name = "ThreadNotFoundError";
    this.threadId = threadId;
  }
}

/**
 * Thrown when a message doesn't exist.
 */
export class MessageNotFoundError extends AdapterError {
  /** @type {string} */
  messageId;

  constructor(adapter, messageId) {
    super(
      `Message '${messageId}' not found in ${adapter}`,
      adapter,
      "MESSAGE_NOT_FOUND"
    );
    this.name = "MessageNotFoundError";
    this.messageId = messageId;
  }
}

// =============================================================================
// Exports
// =============================================================================

export default {
  AdapterError,
  AdapterRateLimitError,
  AuthenticationError,
  ResourceNotFoundError,
  PermissionError,
  ValidationError,
  NetworkError,
  AdapterNotFoundError,
  ThreadNotFoundError,
  MessageNotFoundError,
};
