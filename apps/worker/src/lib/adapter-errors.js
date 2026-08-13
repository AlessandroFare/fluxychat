/**
 * CP-060: Standardized adapter error hierarchy (Vercel Chat SDK parity).
 */

export class AdapterError extends Error {
  /** @param {string} message @param {string} adapter @param {string} [code] */
  constructor(message, adapter, code) {
    super(message);
    this.name = "AdapterError";
    this.adapter = adapter;
    this.code = code;
  }
}

export class AdapterRateLimitError extends AdapterError {
  /** @param {string} adapter @param {number} [retryAfter] */
  constructor(adapter, retryAfter) {
    super(
      `Rate limited by ${adapter}${retryAfter ? `, retry after ${retryAfter}s` : ""}`,
      adapter,
      "RATE_LIMITED",
    );
    this.name = "AdapterRateLimitError";
    this.retryAfter = retryAfter;
  }
}

export class AuthenticationError extends AdapterError {
  constructor(adapter, message) {
    super(message || `Authentication failed for ${adapter}`, adapter, "AUTH_FAILED");
    this.name = "AuthenticationError";
  }
}

export class ResourceNotFoundError extends AdapterError {
  constructor(adapter, resourceType, resourceId) {
    const idPart = resourceId ? ` '${resourceId}'` : "";
    super(`${resourceType}${idPart} not found in ${adapter}`, adapter, "NOT_FOUND");
    this.name = "ResourceNotFoundError";
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}

export class PermissionError extends AdapterError {
  constructor(adapter, action, requiredScope) {
    const scopePart = requiredScope ? ` (requires: ${requiredScope})` : "";
    super(`Permission denied: cannot ${action} in ${adapter}${scopePart}`, adapter, "PERMISSION_DENIED");
    this.name = "PermissionError";
    this.action = action;
    this.requiredScope = requiredScope;
  }
}

export class ValidationError extends AdapterError {
  constructor(adapter, message) {
    super(message, adapter, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export class NetworkError extends AdapterError {
  constructor(adapter, message, originalError) {
    super(message || `Network error communicating with ${adapter}`, adapter, "NETWORK_ERROR");
    this.name = "NetworkError";
    this.originalError = originalError;
  }
}

/** Platform-specific mention string for adapters. CP-061 */
const MENTION_FORMATS = {
  slack: (userId) => `<@${userId}>`,
  discord: (userId) => `<@${userId}>`,
  teams: (userId) => `<at>${userId}</at>`,
  telegram: (userId) => `@${userId}`,
  matrix: (userId) => `@${userId}:matrix`,
  web: (userId) => `@${userId}`,
};

export function mentionUser(adapterName, userId) {
  const fn = MENTION_FORMATS[String(adapterName || "web").toLowerCase()];
  return fn ? fn(userId) : `@${userId}`;
}
