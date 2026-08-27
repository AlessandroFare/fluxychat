import { parseAllowedOrigins, isDemoOriginAllowed } from "./demo-guard.js";
import { checkAndConsumeIpRateLimit } from "./ip-rate-limit.js";
import { isTurnstileConfigured, verifyTurnstileToken } from "./turnstile.js";
import { validateEmbedParentOrigin } from "./embed-config.js";
import { isPublicGuestEnabled, isPublicGuestReadOnly } from "./guest-auth.js";

/**
 * Rate limit / origin / Turnstile gate for public guest sessions.
 * @param {*} env
 * @param {Request} request
 * @param {{
 *   turnstileToken?: string,
 *   projectId?: string,
 *   embedConfig?: { enabled: boolean, allowedOrigins?: string[] } | null,
 *   embedParentOrigin?: string | null,
 * }} options
 */
export async function guardPublicGuestRequest(env, request, options = {}) {
  const allowedOrigins = parseAllowedOrigins(
    env.PUBLIC_GUEST_ALLOWED_ORIGINS || env.DEMO_ALLOWED_ORIGINS,
  );
  if (!isDemoOriginAllowed(request, allowedOrigins, env)) {
    return { ok: false, status: 403, error: "origin_forbidden" };
  }

  if (options.projectId && options.embedConfig) {
    const embedCheck = await validateEmbedParentOrigin(env, request, {
      projectId: options.projectId,
      embedConfig: options.embedConfig,
      parentOrigin: options.embedParentOrigin,
    });
    if (!embedCheck.ok) {
      return { ok: false, status: 403, error: embedCheck.error };
    }
  }

  const ipLimit = Number(env.RATE_LIMIT_PUBLIC_GUEST_PER_MINUTE || 30);
  const ipRate = await checkAndConsumeIpRateLimit(env, {
    request,
    scope: "public-guest-session",
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

  const turnstileRequired =
    env.PUBLIC_GUEST_TURNSTILE_REQUIRED === "true" ||
    env.PUBLIC_GUEST_TURNSTILE_REQUIRED === "1";

  if (turnstileRequired && isTurnstileConfigured(env)) {
    const verified = await verifyTurnstileToken(
      env,
      options.turnstileToken,
      request,
    );
    if (!verified.success) {
      return { ok: false, status: 403, error: "turnstile_failed" };
    }
  }

  return { ok: true };
}

/**
 * Public config for embed/demo UIs — site key is safe to expose.
 * @param {*} env
 */
export function getPublicGuestHardeningConfig(env) {
  const turnstileConfigured = isTurnstileConfigured(env);
  const turnstileRequired =
    env.PUBLIC_GUEST_TURNSTILE_REQUIRED === "true" ||
    env.PUBLIC_GUEST_TURNSTILE_REQUIRED === "1";
  const siteKey = env.TURNSTILE_SITE_KEY?.trim() || null;

  return {
    publicGuestEnabled: isPublicGuestEnabled(env),
    readOnlyGuest: isPublicGuestReadOnly(env),
    rateLimitPerMinute: Math.min(
      Math.max(Number(env.RATE_LIMIT_PUBLIC_GUEST_PER_MINUTE || 30), 1),
      600,
    ),
    turnstile: {
      configured: turnstileConfigured,
      required: turnstileRequired && turnstileConfigured,
      siteKey: turnstileConfigured && siteKey ? siteKey : null,
    },
  };
}
