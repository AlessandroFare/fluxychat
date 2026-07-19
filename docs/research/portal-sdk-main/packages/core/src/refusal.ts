import { isRefusalCode, type RefusalCode } from "@portalsdk/wire-protocol";

import {
  AnonymousNotAllowedError,
  ChannelAtCapacityError,
  InvalidApiKeyError,
  NotMemberError,
  PortalError,
  TokenExpiredError,
} from "./errors.js";

/**
 * How the connection reacts to an upgrade refusal.
 *
 * - `terminal` — no reconnect loop; the connection settles at `status: "blocked"` and
 *   `error` is surfaced.
 * - `token-expired` — the token may be stale; a callback token is re-resolved once and
 *   the connection retried. `error` is what to surface once that one retry is spent (or
 *   immediately, for a static string token that cannot be re-resolved).
 */
export type RefusalDecision =
  | { kind: "terminal"; error: PortalError }
  | { kind: "token-expired"; error: TokenExpiredError };

const invalidApiKeyMessage = (reason: string | undefined): string =>
  reason ??
  "The apiKey was rejected. Pass your publishable key, not a secret key — a secret key must never ship in a browser bundle.";

const withReason = (base: string, reason: string | undefined): string =>
  reason ? `${base}: ${reason}` : base;

/**
 * Classify an upgrade refusal (§1.1) into an error and a reconnect disposition.
 *
 * A code this version does not recognise is treated as a terminal failure rather than
 * coerced into a known one — a refusal we cannot reason about must not silently retry.
 */
export function classifyRefusal(code: string, reason?: string): RefusalDecision {
  if (!isRefusalCode(code)) {
    return {
      kind: "terminal",
      error: new PortalError(code, withReason("The connection was refused", reason)),
    };
  }

  const known: RefusalCode = code;
  switch (known) {
    case "token_expired":
      return {
        kind: "token-expired",
        error: new TokenExpiredError(withReason("The token has expired", reason)),
      };
    case "invalid_api_key":
      return {
        kind: "terminal",
        error: new InvalidApiKeyError(invalidApiKeyMessage(reason)),
      };
    case "not_member":
      return {
        kind: "terminal",
        error: new NotMemberError(
          withReason("You are not a member of this channel", reason),
        ),
      };
    case "anonymous_not_allowed":
      return {
        kind: "terminal",
        error: new AnonymousNotAllowedError(
          withReason("This channel does not allow anonymous access", reason),
        ),
      };
    case "channel_at_capacity":
      return {
        kind: "terminal",
        error: new ChannelAtCapacityError(
          withReason("The channel is at capacity", reason),
        ),
      };
    // No dedicated public class in §8: surfaced as a base PortalError carrying the code.
    case "invalid_token":
      return {
        kind: "terminal",
        error: new PortalError(known, withReason("The token was rejected", reason)),
      };
    case "banned":
      return {
        kind: "terminal",
        error: new PortalError(
          known,
          withReason("You are banned from this channel", reason),
        ),
      };
    case "unknown_channel":
      return {
        kind: "terminal",
        error: new PortalError(known, withReason("No such channel", reason)),
      };
    case "unsupported_version":
      return {
        kind: "terminal",
        error: new PortalError(
          known,
          withReason("The server does not support this protocol version", reason),
        ),
      };
  }
}
