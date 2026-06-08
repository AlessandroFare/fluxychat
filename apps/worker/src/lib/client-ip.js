/**
 * Best-effort client IP for edge rate limits (Cloudflare or reverse proxy).
 * @param {Request} request
 * @returns {string}
 */
export function clientIpFromRequest(request) {
  const cf = request.headers.get("CF-Connecting-IP");
  if (cf?.trim()) return cf.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}
