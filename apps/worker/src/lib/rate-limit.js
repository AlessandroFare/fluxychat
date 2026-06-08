import { logInfo, logError } from "./worker-log.js";

const localRateLimitStore = new Map();

export async function checkAndConsumeRateLimit(env, options) {
  const { key, limit, windowSeconds } = options;
  if (!key || !Number.isFinite(limit) || limit <= 0) {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  const windowMs = Math.max(1, Number(windowSeconds || 60) * 1000);
  const now = Date.now();
  const allowFallback =
    env.RATE_LIMIT_FALLBACK_ALLOW === "true" || env.ECC_HOOK_PROFILE === "minimal";

  if (env.RATE_LIMIT_KV) {
    try {
      const bucketTs = Math.floor(now / windowMs) * windowMs;
      const storageKey = `rl:${key}:${bucketTs}`;
      const existingRaw = await env.RATE_LIMIT_KV.get(storageKey);
      const existing = Number(existingRaw || "0");
      if (existing >= limit) {
        const retryAfterSeconds = Math.ceil((bucketTs + windowMs - now) / 1000);
        return { allowed: false, retryAfterSeconds };
      }
      await env.RATE_LIMIT_KV.put(storageKey, String(existing + 1), {
        expirationTtl: Math.ceil(windowMs / 1000) + 5,
      });
      return { allowed: true, retryAfterSeconds: 0 };
    } catch (err) {
      logError("rate_limit.kv_error", err, { key, traceId: options.traceId });
      return {
        allowed: false,
        retryAfterSeconds: 5,
        reason: "kv_error",
      };
    }
  }

  if (!allowFallback) {
    logInfo("rate_limit.no_kv_denied", {
      key,
      reason: "RATE_LIMIT_KV not configured and fallback is disabled",
    });
    return { allowed: false, retryAfterSeconds: 5, reason: "kv_unavailable" };
  }

  const entry = localRateLimitStore.get(key);
  if (!entry || entry.expiresAt <= now) {
    localRateLimitStore.set(key, { count: 1, expiresAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (entry.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.expiresAt - now) / 1000)),
    };
  }
  entry.count += 1;
  localRateLimitStore.set(key, entry);
  return { allowed: true, retryAfterSeconds: 0 };
}
