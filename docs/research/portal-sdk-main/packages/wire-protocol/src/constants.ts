/**
 * Protocol version carried by every upgrade as `?v=` (§1.1, §6).
 *
 * An unknown version is refused at the upgrade with HTTP 426 `unsupported_version`.
 * Within v1 the protocol evolves additively only; a breaking change bumps this.
 */
export const PROTOCOL_VERSION = 1;

/**
 * Upgrade query-parameter names (§1.1). Build upgrade URLs from these rather than
 * string literals, so a rename is a compile error rather than a silent 4xx.
 *
 * - `version` — required on every upgrade; unknown → 426.
 * - `token` — the signed JWT. Identifies the user.
 * - `key` — the publishable apiKey, identifying the app (§1 credential transport).
 * - `leaf` — opaque reconnect token; echo back what `ready` gave you, unchanged.
 * - `meta` — initial presence metadata, base64 JSON (standard channels; ≤1KB decoded).
 * - `last` — highest contiguous seq held, sent on reconnect to request replay (§1.4).
 */
export const UPGRADE_PARAMS = {
  version: "v",
  token: "token",
  key: "key",
  leaf: "leaf",
  meta: "meta",
  last: "last",
} as const;

/**
 * Response header carrying the refusal code on a refused upgrade (§1.1).
 *
 * Duplicates `code` from the body so a client behind a body-eating proxy can still
 * tell why the socket never opened.
 */
export const PORTAL_ERROR_HEADER = "x-portal-error";
