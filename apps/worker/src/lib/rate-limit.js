import { logInfo, logError } from "./worker-log.js";

const localRateLimitStore = new Map();

// Audit S-19: tiny in-process lock map to serialise concurrent get+put on the
// same key. Cloudflare KV (and the local fallback) have no atomic increment,
// so without this guard N concurrent requests can each observe count=0 and
// all succeed. The lock is per-isolate and best-effort  true correctness
// requires a DO. The DO-based IP rate limiter in `ip-rate-limiter-do.js`
// already serialises correctly; this just closes the local-fallback race.
const keyLocks = new Map();

async function withKeyLock(key, fn) {
  const previous = keyLocks.get(key) || Promise.resolve();
  let release;
  const next = new Promise((resolve) => {
    release = resolve;
  });
  keyLocks.set(key, previous.then(() => next));
  try {
    await previous;
    return await fn();
  } finally {
    release();
    // Best-effort cleanup so the lock map does not grow unbounded.
    if (keyLocks.get(key) === next) keyLocks.delete(key);
  }
}

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
      // Serialise per key: the get+put pair is not atomic in KV, so concurrent
      // callers can race. The lock is per-isolate; for true cluster-wide
      // atomicity use the IP rate limiter DO.
      return await withKeyLock(storageKey, async () => {
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
      });
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

  return withKeyLock(`local:${key}`, async () => {
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
  });
}
