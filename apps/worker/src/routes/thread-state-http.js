import { pickRouteDeps } from "./route-http-deps.js";
import { resolveAppKv } from "../lib/app-kv.js";
import { createThreadStateStore } from "../lib/thread-state.js";

/**
 * Per-thread typed state (Portal B-5).
 * GET/PUT/DELETE /api/threads/:threadId/state
 */
export async function dispatchThreadStateRoutes(request, url, h) {
  const match = url.pathname.match(/^\/api\/threads\/([^/]+)\/state$/);
  if (!match) return null;

  const threadId = decodeURIComponent(match[1]);
  const {
    env,
    json,
    corsHeaders,
    verifyJwtAndGetContext,
  } = pickRouteDeps(h, ["env", "json", "corsHeaders", "verifyJwtAndGetContext"]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    return null;
  });
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const kv = resolveAppKv(env);
  if (!kv) {
    return json({ error: "kv_not_configured" }, { status: 503, headers: corsHeaders });
  }

  const store = createThreadStateStore(kv);
  const scopedKey = `${auth.projectId}:${threadId}`;

  if (request.method === "GET") {
    const entry = await store.get(scopedKey);
    return json({ threadId, state: entry?.state ?? null, expiresAt: entry?.expiresAt ?? null }, { headers: corsHeaders });
  }

  if (request.method === "PUT") {
    const body = await request.json().catch(() => ({}));
    const ttlMs = body.ttlMs != null ? Number(body.ttlMs) : 30 * 24 * 60 * 60 * 1000;
    await store.set(scopedKey, body.state ?? {}, ttlMs);
    return json({ ok: true, threadId }, { headers: corsHeaders });
  }

  if (request.method === "DELETE") {
    await store.delete(scopedKey);
    return json({ ok: true, threadId }, { headers: corsHeaders });
  }

  return null;
}
