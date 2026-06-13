/**
 * P15-L: Conversational Analytics HTTP Routes.
 *
 * POST /enterprise/analytics/query    — query analytics via NL
 * GET  /enterprise/analytics/history   — query history
 * DELETE /enterprise/analytics/cache   — clear cache
 */
import { pickRouteDeps } from "./route-http-deps.js";
import { queryAnalytics, getQueryHistory, clearQueryCache } from "../lib/conversational-analytics.js";

export async function dispatchAnalyticsRoutes(request, url, h) {
  const {
    env, json, corsHeaders, requestLogCtx,
    verifyJwtAndGetContext, logError, hasAnyRole,
  } = pickRouteDeps(h, ["env", "json", "corsHeaders", "requestLogCtx", "verifyJwtAndGetContext", "logError", "hasAnyRole"]);

  async function adminAuth() {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return null;
    if (!hasAnyRole(auth.roles, ["owner", "admin"])) return null;
    return auth;
  }

  if (url.pathname === "/enterprise/analytics/query" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.query) return json({ error: "query is required" }, { status: 400 });
    const result = await queryAnalytics(env, {
      projectId: auth.projectId, queryText: body.query, userId: auth.userId,
      forceRefresh: body.forceRefresh,
    });
    return json(result);
  }

  if (url.pathname === "/enterprise/analytics/history" && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const params = Object.fromEntries(url.searchParams);
    const history = await getQueryHistory(env, {
      projectId: auth.projectId,
      limit: params.limit ? parseInt(params.limit) : 20,
    });
    return json({ queries: history, count: history.length });
  }

  if (url.pathname === "/enterprise/analytics/cache" && request.method === "DELETE") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const cleared = await clearQueryCache(env, { projectId: auth.projectId });
    return json({ cleared });
  }

  return null;
}
