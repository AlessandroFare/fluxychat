/**
 * Next.js (or any Fetch) route: mint a FluxyChat member JWT using fc_ on the server.
 * Clerk / Auth.js / Better Auth: pass getUserId from your session. pk_ cannot mint.
 */

export interface CreateFluxyTokenRouteOptions {
  workerUrl: string;
  /** Secret API key (fc_). Never send to the browser. */
  apiKey: string;
  getUserId: (request: Request) => Promise<string | null> | string | null;
  /** Default 3600. Capped by the Worker. */
  ttlSeconds?: number;
  roles?: string[];
}

export function createFluxyTokenRoute(options: CreateFluxyTokenRouteOptions) {
  return async function fluxyTokenPost(request: Request): Promise<Response> {
    const userId = await options.getUserId(request);
    if (!userId?.trim()) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    const base = options.workerUrl.replace(/\/+$/, "");
    const res = await fetch(`${base}/auth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Fluxy-Api-Key": options.apiKey,
      },
      body: JSON.stringify({
        userId: userId.trim(),
        ttlSeconds: options.ttlSeconds,
        roles: options.roles,
      }),
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" },
    });
  };
}
