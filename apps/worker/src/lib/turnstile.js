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
      // Audit F-38: optional hostname binding — a token minted on another site
      // (shared/misconfigured sitekey) must not pass. Configure the expected
      // host(s) in TURNSTILE_EXPECTED_HOSTNAME (comma-separated, `*.suffix` ok).
      const expected = parseExpectedHostnames(env.TURNSTILE_EXPECTED_HOSTNAME);
      if (expected.length) {
        const hostname = String(data.hostname || "").toLowerCase();
        const matched = expected.some((entry) =>
          entry.startsWith("*.")
            ? hostname.endsWith(entry.slice(1)) && hostname.length > entry.length - 1
            : hostname === entry,
        );
        if (!matched) {
          return { success: false, errorCodes: ["hostname-mismatch"] };
        }
      }
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

function parseExpectedHostnames(value) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}
