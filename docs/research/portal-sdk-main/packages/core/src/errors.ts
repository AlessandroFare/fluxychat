/**
 * The public error hierarchy (§8).
 *
 * Every error the SDK surfaces is a {@link PortalError} carrying a stable `code`. Named
 * subclasses exist for the failures a caller reacts to differently; other refusals arrive
 * as a base {@link PortalError} with the wire code, so a caller can still branch on `code`.
 */
export class PortalError extends Error {
  /** Stable, machine-readable discriminator. Safe to branch on. */
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

/**
 * A bad or unknown `apiKey` (§1). Terminal: the connection goes to `status: "blocked"`
 * with no reconnect loop. The message distinguishes a publishable-key mistake from a
 * secret key pasted into the browser.
 */
export class InvalidApiKeyError extends PortalError {
  constructor(message: string) {
    super("invalid_api_key", message);
  }
}

/**
 * A gate or middleware refused the send (§4). `reason` is end-user-visible copy — render
 * it in the send-rejection UX.
 */
export class BlockedError extends PortalError {
  readonly reason: string;

  constructor(reason: string, message?: string) {
    super("blocked", message ?? reason);
    this.reason = reason;
  }
}

/**
 * The token was rejected as expired (refusal or HTTP 401). A callback token is re-resolved
 * once and retried; a still-failing retry — or a static string token, which cannot be
 * re-resolved — surfaces this error and moves `status` to `"blocked"`.
 */
export class TokenExpiredError extends PortalError {
  constructor(message: string) {
    super("token_expired", message);
  }
}

/** A membership channel with no row for this user (on connect, or on a `to:`-send). */
export class NotMemberError extends PortalError {
  constructor(message: string) {
    super("not_member", message);
  }
}

/** The channel refused admission at its hard cap. */
export class ChannelAtCapacityError extends PortalError {
  constructor(message: string) {
    super("channel_at_capacity", message);
  }
}

/** The channel is configured `anonymous: false` and the token is anonymous. */
export class AnonymousNotAllowedError extends PortalError {
  constructor(message: string) {
    super("anonymous_not_allowed", message);
  }
}

/**
 * A reserved surface was used in v1 — a `where` filter on a channel, attachments, or a
 * non-text media kind. Typed but rejected loudly.
 */
export class NotYetSupportedError extends PortalError {
  constructor(message: string) {
    super("not_yet_supported", message);
  }
}

/** A send into an extension namespace whose extension is degraded; the channel keeps working. */
export class DegradedError extends PortalError {
  constructor(message: string) {
    super("degraded", message);
  }
}
