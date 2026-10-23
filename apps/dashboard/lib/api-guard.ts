import { auth } from "@clerk/nextjs/server";
import { isClerkEnabled } from "@/lib/clerk-config";

/**
 * Audit #34: guard for dashboard routes that proxy the Worker using the bearer
 * JWT forwarded by the browser.
 *
 * - Rejects cross-origin browser calls (any mismatched `Origin` header).
 * - When Clerk is configured (hosted), also requires a live Clerk session, so
 *   a leaked/forwarded JWT alone cannot be replayed against the proxy.
 *
 * Returns a rejection Response, or null when the request may proceed.
 */
export async function rejectUnauthorizedProxyRequest(
  request: Request,
): Promise<Response | null> {
  const origin = request.headers.get("origin");
  if (origin) {
    let sameOrigin = false;
    try {
      sameOrigin = origin === new URL(request.url).origin;
    } catch {
      sameOrigin = false;
    }
    if (!sameOrigin) {
      return Response.json({ error: "cross_origin_forbidden" }, { status: 403 });
    }
  }

  if (isClerkEnabled()) {
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: "Sign in required" }, { status: 401 });
    }
  }

  return null;
}
