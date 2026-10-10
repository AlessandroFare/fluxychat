import {
  FLUXY_ERROR_CODES,
  fluxyErrorByIdentifier,
  type FluxyErrorCatalogEntry,
  type FluxyErrorIdentifier,
} from "@fluxy-chat/protocol";

/** Worker closes unauthorized / forbidden WebSocket joins with 1008. */
export const FLUXY_WS_CLOSE_POLICY = 1008;

/** Normal client-initiated close. */
export const FLUXY_WS_CLOSE_NORMAL = 1000;

export function unableTo(operation: string, reason: string): string {
  return `unable to ${operation}; ${reason}`;
}

/**
 * Catalog-backed error (numeric code + HTTP status + docs href).
 * Subclasses on the SDK stay for instanceof; wrap them with {@link toFluxyErrorInfo}.
 */
export class FluxyErrorInfo extends Error {
  readonly code: number;
  readonly statusCode: number;
  readonly identifier: string;
  readonly href: string;
  readonly terminal: boolean;
  readonly cause?: unknown;

  constructor(options: {
    identifier: FluxyErrorIdentifier | string;
    operation?: string;
    reason?: string;
    cause?: unknown;
  }) {
    const entry = fluxyErrorByIdentifier(options.identifier);
    const reason = options.reason ?? entry?.title ?? options.identifier;
    super(unableTo(options.operation ?? "complete request", reason));
    this.name = "FluxyErrorInfo";
    this.code = entry?.code ?? 0;
    this.statusCode = entry?.httpStatus ?? 0;
    this.identifier = entry?.identifier ?? String(options.identifier);
    this.href = entry?.href ?? "";
    this.terminal = entry?.terminal ?? false;
    this.cause = options.cause;
  }
}

/** Ably `errorInfoIs` — match catalog identifier or numeric code. */
export function errorInfoIs(error: unknown, match: FluxyErrorIdentifier | string | number): boolean {
  if (!(error instanceof FluxyErrorInfo)) return false;
  if (typeof match === "number") return error.code === match;
  return error.identifier === match;
}

export function catalogEntryForRefusal(
  identifier: string | undefined,
): FluxyErrorCatalogEntry | undefined {
  if (!identifier) return fluxyErrorByIdentifier("auth_refused");
  return fluxyErrorByIdentifier(identifier) ?? fluxyErrorByIdentifier("auth_refused");
}

export class FluxyAuthError extends Error {
  readonly code = FLUXY_WS_CLOSE_POLICY;
  readonly numericCode: number;
  /** Machine-readable refusal when parsed from close reason (Portal-style). */
  readonly refusalCode?: string;

  constructor(
    message = "Authentication or room access failed (WebSocket close 1008). Check your JWT, API key, and room membership.",
    refusalCode?: string,
  ) {
    super(message);
    this.name = "FluxyAuthError";
    this.refusalCode = refusalCode;
    this.numericCode = catalogEntryForRefusal(refusalCode)?.code ?? FLUXY_ERROR_CODES.auth_refused;
  }
}

/** Room membership refused — user is not a member of the channel. */
export class FluxyNotMemberError extends FluxyAuthError {
  constructor(message = "You are not a member of this room.") {
    super(message, "not_member");
    this.name = "FluxyNotMemberError";
  }
}

/** JWT rejected as expired or invalid. */
export class FluxyTokenExpiredError extends FluxyAuthError {
  constructor(message = "Session token expired or invalid.") {
    super(message, "token_expired");
    this.name = "FluxyTokenExpiredError";
  }
}

/** Channel requires authenticated (non-anonymous) identity. */
export class FluxyAnonymousNotAllowedError extends FluxyAuthError {
  constructor(message = "This room does not allow anonymous access.") {
    super(message, "anonymous_not_allowed");
    this.name = "FluxyAnonymousNotAllowedError";
  }
}

export class FluxyConnectionError extends Error {
  readonly code: number;
  readonly numericCode = FLUXY_ERROR_CODES.connection_failed;
  readonly reason: string;

  constructor(code: number, reason = "", message?: string) {
    super(message ?? `WebSocket closed unexpectedly (code ${code}${reason ? `: ${reason}` : ""}).`);
    this.name = "FluxyConnectionError";
    this.code = code;
    this.reason = reason;
  }
}

export class FluxySendError extends Error {
  readonly numericCode = FLUXY_ERROR_CODES.send_not_open;

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

export function parseConnectionRefusal(reason: string): string | null {
  const text = reason.trim().toLowerCase();
  if (!text) return null;
  if (text.includes("not_member") || text.includes("not a member") || text.includes("forbidden")) {
    return text.includes("forbidden") && !text.includes("not") ? "forbidden" : "not_member";
  }
  if (text.includes("token_expired") || text.includes("expired")) return "token_expired";
  if (text.includes("invalid_token") || text.includes("invalid token")) return "invalid_token";
  if (text.includes("anonymous_not_allowed") || text.includes("anonymous")) return "anonymous_not_allowed";
  if (text.includes("channel_at_capacity") || text.includes("at capacity")) return "channel_at_capacity";
  if (text.includes("banned")) return "banned";
  if (text.includes("invalid_api_key")) return "invalid_api_key";
  return null;
}

export function mapWebSocketCloseToError(code: number, reason = ""): Error | null {
  if (code === FLUXY_WS_CLOSE_NORMAL) return null;
  if (code === FLUXY_WS_CLOSE_POLICY) {
    const refusal = parseConnectionRefusal(reason);
    if (refusal === "not_member" || refusal === "forbidden") {
      return new FluxyNotMemberError(
        refusal === "forbidden"
          ? "You are not a member of this room (WebSocket close 1008 Forbidden). Join the room or use an admin JWT."
          : undefined,
      );
    }
    if (refusal === "token_expired" || refusal === "invalid_token") {
      return new FluxyTokenExpiredError();
    }
    if (refusal === "anonymous_not_allowed") {
      return new FluxyAnonymousNotAllowedError();
    }
    const text = reason.trim();
    if (text.toLowerCase().includes("forbidden")) {
      return new FluxyNotMemberError(
        "You are not a member of this room (WebSocket close 1008 Forbidden). Join the room or use an admin JWT.",
      );
    }
    return new FluxyAuthError(undefined, refusal ?? undefined);
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

export interface FluxyConnectionErrorInfo {
  code: string;
  numericCode: number;
  href: string;
  message: string;
  /** True when reconnect will not help (auth/membership refusal). Portal-style `blocked`. */
  isTerminal: boolean;
  isMemberIssue: boolean;
}

function describeFromCatalog(
  identifier: string,
  message: string,
  extras: { isMemberIssue: boolean },
): FluxyConnectionErrorInfo {
  const entry = catalogEntryForRefusal(identifier);
  return {
    code: identifier,
    numericCode: entry?.code ?? 0,
    href: entry?.href ?? "",
    message,
    isTerminal: entry?.terminal ?? true,
    isMemberIssue: extras.isMemberIssue,
  };
}

/** User-facing copy for connection failures — branch on stable refusal codes. */
export function describeConnectionError(error: Error | null | undefined): FluxyConnectionErrorInfo | null {
  if (!error) return null;
  if (error instanceof FluxyNotMemberError) {
    return describeFromCatalog("not_member", error.message, { isMemberIssue: true });
  }
  if (error instanceof FluxyTokenExpiredError) {
    return describeFromCatalog("token_expired", error.message, { isMemberIssue: false });
  }
  if (error instanceof FluxyAnonymousNotAllowedError) {
    return describeFromCatalog("anonymous_not_allowed", error.message, { isMemberIssue: false });
  }
  if (error instanceof FluxyAuthError) {
    return describeFromCatalog(error.refusalCode ?? "auth_refused", error.message, {
      isMemberIssue: false,
    });
  }
  if (error instanceof FluxyConnectionError) {
    const entry = fluxyErrorByIdentifier("connection_failed");
    return {
      code: `ws_${error.code}`,
      numericCode: entry?.code ?? FLUXY_ERROR_CODES.connection_failed,
      href: entry?.href ?? "",
      message: error.message,
      isTerminal: false,
      isMemberIssue: false,
    };
  }
  return {
    code: "unknown",
    numericCode: 0,
    href: "",
    message: error.message,
    isTerminal: false,
    isMemberIssue: false,
  };
}

export function toFluxyErrorInfo(
  error: Error,
  operation = "connect",
): FluxyErrorInfo {
  if (error instanceof FluxyErrorInfo) return error;
  if (error instanceof FluxyNotMemberError) {
    return new FluxyErrorInfo({ identifier: "not_member", operation, reason: error.message, cause: error });
  }
  if (error instanceof FluxyTokenExpiredError) {
    return new FluxyErrorInfo({ identifier: "token_expired", operation, reason: error.message, cause: error });
  }
  if (error instanceof FluxyAnonymousNotAllowedError) {
    return new FluxyErrorInfo({
      identifier: "anonymous_not_allowed",
      operation,
      reason: error.message,
      cause: error,
    });
  }
  if (error instanceof FluxySendError) {
    return new FluxyErrorInfo({ identifier: "send_not_open", operation: "send", reason: error.message, cause: error });
  }
  if (error instanceof FluxyAuthError) {
    return new FluxyErrorInfo({
      identifier: error.refusalCode ?? "auth_refused",
      operation,
      reason: error.message,
      cause: error,
    });
  }
  if (error instanceof FluxyConnectionError) {
    return new FluxyErrorInfo({
      identifier: "connection_failed",
      operation,
      reason: error.message,
      cause: error,
    });
  }
  return new FluxyErrorInfo({
    identifier: "connection_failed",
    operation,
    reason: error.message,
    cause: error,
  });
}
