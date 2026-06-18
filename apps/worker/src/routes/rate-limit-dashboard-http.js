/**
 * P14-J: Rate Limit Dashboard HTTP Routes.
 *
 * GET  /rate-limit-dashboard/summary     — usage summary
 * GET  /rate-limit-dashboard/thresholds  — current thresholds
 * GET  /rate-limit-dashboard/denials     — recent denials
 * GET  /rate-limit-dashboard/events      — log an event (internal)
 */
import { pickRouteDeps } from "./route-http-deps.js";
import {
  recordRateLimitEvent,
  getRateLimitSummary,
  getRateLimitThresholds,
  getRecentDenials,
} from "../lib/rate-limit-dashboard.js";

export async function dispatchRateLimitDashboardRoutes(request, url, h) {
  const {
    env, json, corsHeaders, requestLogCtx,
    verifyJwtAndGetContext, logError, hasAnyRole,
  } = pickRouteDeps(h, ["env", "json", "corsHeaders", "requestLogCtx", "verifyJwtAndGetContext", "logError", "hasAnyRole"]);

  async function auth() {
    const a = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    return a;
  }

  // GET /rate-limit-dashboard/summary
  if (url.pathname === "/rate-limit-dashboard/summary" && request.method === "GET") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!hasAnyRole(a, ["owner", "admin"])) return new Response("Forbidden", { status: 403, headers: corsHeaders });
    const windowMinutes = parseInt(url.searchParams.get("window") || "60", 10);
    const summary = await getRateLimitSummary(env, { projectId: a.projectId, windowMinutes });
    return json(summary);
  }

  // GET /rate-limit-dashboard/thresholds
  if (url.pathname === "/rate-limit-dashboard/thresholds" && request.method === "GET") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!hasAnyRole(a, ["owner", "admin"])) return new Response("Forbidden", { status: 403, headers: corsHeaders });
    const thresholds = await getRateLimitThresholds(env, { projectId: a.projectId });
    return json({ thresholds });
  }

  // GET /rate-limit-dashboard/denials
  if (url.pathname === "/rate-limit-dashboard/denials" && request.method === "GET") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!hasAnyRole(a, ["owner", "admin"])) return new Response("Forbidden", { status: 403, headers: corsHeaders });
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const denials = await getRecentDenials(env, { projectId: a.projectId, limit });
    return json({ denials });
  }

  // POST /rate-limit-dashboard/events (internal logging endpoint)
  if (url.pathname === "/rate-limit-dashboard/events" && request.method === "POST") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.key) return json({ error: "key required" }, { status: 400 });
    await recordRateLimitEvent(env, {
      projectId: a.projectId,
      key: body.key,
      limit: body.limit || 100,
      windowSeconds: body.windowSeconds || 60,
      allowed: body.allowed !== false,
      currentCount: body.currentCount || 0,
      retryAfterSeconds: body.retryAfterSeconds || 0,
      reason: body.reason,
    });
    return json({ ok: true }, { status: 201 });
  }

  return null;
}

