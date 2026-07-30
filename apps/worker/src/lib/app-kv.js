/**
 * General-purpose KV for HITL approvals, thread state, etc.
 * Falls back to RATE_LIMIT_KV when KV is not bound (local wrangler dev).
 */
export function resolveAppKv(env) {
  return env?.KV ?? env?.RATE_LIMIT_KV ?? null;
}
