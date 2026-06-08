import { clientIpFromRequest } from "./client-ip.js";
import { checkAndConsumeIpRateLimit } from "./ip-rate-limit.js";
import { isTurnstileConfigured, verifyTurnstileToken } from "./turnstile.js";

/**
 * @param {string | undefined} envValue Comma-separated origins (e.g. https://app.example.com)
 * @returns {string[]}
 */
export function parseAllowedOrigins(envValue) {
  if (!envValue?.trim()) return [];
  return envValue
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * @param {Request} request
 * @param {string[]} allowedOrigins Empty = allow all (dev default).
 */
export function isDemoOriginAllowed(request, allowedOrigins) {
  if (!allowedOrigins.length) return true;

  const origin = request.headers.get("Origin")?.trim();
  if (origin && allowedOrigins.includes(origin)) return true;

  const referer = request.headers.get("Referer")?.trim();
  if (referer) {
    for (const allowed of allowedOrigins) {
      if (referer === allowed || referer.startsWith(`${allowed}/`)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Gate public demo session minting (origin, IP rate limit, optional Turnstile).
 * @param {*} env
 * @param {Request} request
 * @param {{ turnstileToken?: string }} options
 * @returns {Promise<{ ok: true } | { ok: false, status: number, error: string, retryAfterSeconds?: number }>}
 */
export async function guardDemoSessionRequest(env, request, options = {}) {
  const allowedOrigins = parseAllowedOrigins(env.DEMO_ALLOWED_ORIGINS);
  if (!isDemoOriginAllowed(request, allowedOrigins)) {
    return { ok: false, status: 403, error: "demo_origin_forbidden" };
  }

  const ipLimit = Number(env.RATE_LIMIT_DEMO_SESSIONS_PER_MINUTE || 20);
  const ipRate = await checkAndConsumeIpRateLimit(env, {
    request,
    scope: "demo-session",
    limit: ipLimit,
    windowSeconds: 60,
  });
  if (!ipRate.allowed) {
    return {
      ok: false,
      status: 429,
      error: "rate_limit_exceeded",
      retryAfterSeconds: ipRate.retryAfterSeconds,
    };
  }

  if (isTurnstileConfigured(env)) {
    if (request.method === "GET" && env.DEMO_ALLOW_GET_WITHOUT_TURNSTILE !== "true") {
      return {
        ok: false,
        status: 405,
        error: "demo_turnstile_required_use_post",
      };
    }
    if (request.method === "POST") {
      const verified = await verifyTurnstileToken(
        env,
        options.turnstileToken,
        request,
      );
      if (!verified.success) {
        return { ok: false, status: 403, error: "turnstile_failed" };
      }
    }
  }

  return { ok: true };
}

export { clientIpFromRequest };
