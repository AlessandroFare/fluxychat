import { clientIpFromRequest } from "./client-ip.js";
import { checkAndConsumeRateLimit } from "./rate-limit.js";

/**
 * IP-scoped rate limit: optional dedicated DO per key, else KV/in-memory fallback.
 * @param {*} env
 * @param {{ request: Request, scope?: string, limit: number, windowSeconds?: number }} options
 */
export async function checkAndConsumeIpRateLimit(env, options) {
  const { request, scope, limit, windowSeconds = 60 } = options;
  const ip = clientIpFromRequest(request, env);
  const scopeKey = scope ? `${scope}:${ip}` : ip;
  const windowMs = Math.max(1, windowSeconds) * 1000;

  if (env.IP_RATE_LIMITER) {
    try {
      const id = env.IP_RATE_LIMITER.idFromName(scopeKey);
      const stub = env.IP_RATE_LIMITER.get(id);
      const url = new URL("https://ip-rate-limiter/check");
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("windowMs", String(windowMs));
      const res = await stub.fetch(url.toString(), { method: "POST" });
      if (!res.ok) {
        return { allowed: false, retryAfterSeconds: 5, reason: "ip_limiter_error" };
      }
      return await res.json();
    } catch {
      return { allowed: false, retryAfterSeconds: 5, reason: "ip_limiter_error" };
    }
  }

  return checkAndConsumeRateLimit(env, {
    key: `ip:${scopeKey}`,
    limit,
    windowSeconds,
  });
}

export { clientIpFromRequest };
