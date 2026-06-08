import { clientIpFromRequest } from "./client-ip.js";

/**
 * Verify a Cloudflare Turnstile token (siteverify API).
 * @param {*} env
 * @param {string | undefined} token
 * @param {Request} request
 * @returns {Promise<{ success: boolean, errorCodes?: string[] }>}
 */
export async function verifyTurnstileToken(env, token, request) {
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    return { success: true };
  }
  if (!token || typeof token !== "string") {
    return { success: false, errorCodes: ["missing-input-response"] };
  }

  const body = new URLSearchParams({
    secret,
    response: token,
    remoteip: clientIpFromRequest(request),
  });

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      },
    );
    const data = await res.json();
    if (data?.success === true) {
      return { success: true };
    }
    return {
      success: false,
      errorCodes: Array.isArray(data?.["error-codes"])
        ? data["error-codes"]
        : ["verify-failed"],
    };
  } catch {
    return { success: false, errorCodes: ["network-error"] };
  }
}

export function isTurnstileConfigured(env) {
  return Boolean(env.TURNSTILE_SECRET_KEY?.trim());
}
