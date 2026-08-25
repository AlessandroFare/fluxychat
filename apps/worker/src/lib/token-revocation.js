/**
 * R7 — JWT token revocation via KV deny-list keyed on `jti`.
 *
 * THREAT
 * ------
 * A stolen JWT is valid until `exp` (default TTLs are hours). Enterprise buyers
 * expect a kill switch. Ably ships token revocation; this closes that gap.
 *
 * MECHANISM
 * ---------
 * - Minting paths add `jti: crypto.randomUUID()` to project tokens.
 * - Revocation writes `revoked:<jti>` into the existing RATE_LIMIT_KV binding
 *   with `expirationTtl` equal to the token's remaining lifetime: the deny
 *   entry self-destructs exactly when the token would have expired anyway, so
 *   the list never grows unbounded and costs ~nothing.
 * - Verification consults the list AFTER signature validation; a revoked token
 *   fails closed with 401 "Token revoked".
 *
 * ponytail: fail-open when RATE_LIMIT_KV is not bound (local dev / degraded
 * mode) — auth must never hard-depend on an optional binding. In hosted mode
 * the binding is always present, so revocation is enforced where it matters.
 */

const KEY_PREFIX = "revoked:";

function remainingTtlSeconds(expSeconds, nowSeconds = Math.floor(Date.now() / 1000)) {
  const exp = Number(expSeconds);
  if (!Number.isFinite(exp)) return null;
  const ttl = Math.floor(exp - nowSeconds);
  // KV minimum TTL is 60s; clamp so short-lived tokens are still coverable.
  return ttl > 0 ? Math.max(60, ttl) : null;
}

/**
 * Mark a token identity as revoked until its natural expiry.
 * @param {*} env  needs env.RATE_LIMIT_KV (get/put)
 */
export async function revokeJti(env, jti, expSeconds) {
  const kv = env?.RATE_LIMIT_KV;
  if (!kv?.put || !jti) return { ok: false, reason: "kv_unavailable" };
  const ttl = remainingTtlSeconds(expSeconds);
  if (ttl == null) {
    // Already expired or unparsable exp: nothing to enforce.
    return { ok: true, alreadyExpired: true };
  }
  await kv.put(`${KEY_PREFIX}${jti}`, "1", { expirationTtl: ttl });
  return { ok: true, jti, ttlSeconds: ttl };
}

/** @returns {Promise<boolean>} true when the jti is on the deny list. */
export async function isJtiRevoked(env, jti) {
  const kv = env?.RATE_LIMIT_KV;
  if (!kv?.get || !jti) return false;
  try {
    const hit = await kv.get(`${KEY_PREFIX}${jti}`);
    return hit === "1";
  } catch {
    // Fail open on KV errors: availability over completeness (see module note).
    return false;
  }
}

/** Convenience: mint-time jti generator (stable shape across all call sites). */
export function newJti() {
  return crypto.randomUUID();
}
