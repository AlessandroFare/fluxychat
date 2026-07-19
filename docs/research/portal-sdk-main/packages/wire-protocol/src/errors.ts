/**
 * Why an upgrade was refused (§1.1).
 *
 * Refusals happen at the HTTP upgrade — **the socket never opens**. They are therefore
 * disjoint from {@link PublishErrorCode} (HTTP publish rejections) and from the
 * in-session `error` frame, which both presuppose a working connection.
 */
export type RefusalCode =
  | "invalid_token"
  | "token_expired"
  | "invalid_api_key"
  | "not_member"
  | "banned"
  | "anonymous_not_allowed"
  | "unknown_channel"
  | "unsupported_version"
  | "channel_at_capacity";

/**
 * The HTTP status each refusal is delivered with (§1.1 table).
 *
 * The mapping is many-to-one: status alone does not identify the cause, so read
 * `code` from the body (or the `x-portal-error` header) rather than branching on status.
 */
export const REFUSAL_STATUS = {
  invalid_token: 401,
  token_expired: 401,
  invalid_api_key: 403,
  not_member: 403,
  banned: 403,
  anonymous_not_allowed: 403,
  unknown_channel: 404,
  unsupported_version: 426,
  channel_at_capacity: 429,
} as const satisfies Record<RefusalCode, number>;

const REFUSAL_CODES: ReadonlySet<string> = new Set(Object.keys(REFUSAL_STATUS));

/**
 * Whether a value is a refusal code this version knows (§1.1).
 *
 * A refusal body arriving with an unrecognised code is not a refusal this client can
 * reason about — treat it as an opaque failure rather than coercing it.
 */
export const isRefusalCode = (value: unknown): value is RefusalCode =>
  typeof value === "string" && REFUSAL_CODES.has(value);

/** Body of a refused upgrade (§1.1). */
export type RefusalBody = {
  code: RefusalCode;
  reason?: string;
  /**
   * Seconds to wait before retrying. Documented for `channel_at_capacity` (429) only
   * (§1.1); absent on every other refusal.
   */
  retryAfter?: number;
};

/**
 * Why an HTTP publish was rejected (§3.1).
 *
 * Deliberately NOT merged into {@link RefusalCode}: these arrive on a live connection
 * in response to `POST /v1/channels/{id}/messages`, and a client reacts to them per
 * send, not per connection.
 *
 * `blocked_by_middleware` carries user-visible copy in `reason`.
 */
export type PublishErrorCode =
  | "not_permitted"
  | "blocked_by_middleware"
  | "content_too_large"
  | "rate_limited";

/**
 * Body of a rejected publish (§3.1).
 *
 * SPEC: §3.1 specifies the shape as `4xx { code, reason? }` but does not map each code
 * to a status, so no status record is exported here (unlike {@link REFUSAL_STATUS}).
 */
export type PublishErrorBody = {
  code: PublishErrorCode;
  reason?: string;
};
