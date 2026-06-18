/**
 * Best-effort client IP for edge rate limits.
 *
 * Security (audit M-4): `X-Forwarded-For` is fully client-controlled and must
 * NOT be trusted unless the Worker is known to sit behind a proxy that rewrites
 * or strips inbound XFF. Trusting it blindly lets an attacker rotate the
 * rate-limit key on every request and bypass IP rate limits.
 *
 * Trust order:
 *   1. `CF-Connecting-IP` — set by Cloudflare, not client-spoofable. Always trusted.
 *   2. `X-Forwarded-For` — only when `env.TRUST_FORWARDED_FOR === "true"`. When
 *      trusted we take the LAST entry (the hop added by our own proxy), not the
 *      first (which is the attacker-controlled left-most value).
 *   3. Fallback marker `"unknown"`.
 *
 * @param {Request} request
 * @param {Record<string, unknown>} [env]
 * @returns {string}
 */
export function clientIpFromRequest(request, env) {
  const cf = request.headers.get("CF-Connecting-IP");
  if (cf?.trim()) return cf.trim();

  if (env && env.TRUST_FORWARDED_FOR === "true") {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      // Take the right-most entry: with a trusted proxy that appends the real
      // client IP, the right-most hop is the one our infrastructure added.
      const parts = forwarded
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      const last = parts[parts.length - 1];
      if (last) return last;
    }
  }

  return "unknown";
}
