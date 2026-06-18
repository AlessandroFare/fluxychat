/**
 * P14-G: AI-Powered Analytics Insights HTTP Routes.
 *
 * POST /ai-analytics/generate        — generate insights
 * GET  /ai-analytics                 — list insights
 * GET  /ai-analytics/:id             — get insight
 * POST /ai-analytics/weekly-digest   — generate weekly digest
 * DELETE /ai-analytics/:id           — delete insight
 */
import { pickRouteDeps } from "./route-http-deps.js";
import {
  generateInsights,
  listInsights,
  getInsight,
  generateWeeklyDigest,
  deleteInsight,
} from "../lib/ai-analytics-insights.js";

export async function dispatchAiAnalyticsRoutes(request, url, h) {
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

  // POST /ai-analytics/generate
  if (url.pathname === "/ai-analytics/generate" && request.method === "POST") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!hasAnyRole(a, ["owner", "admin"])) return new Response("Forbidden", { status: 403, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.insightType) return json({ error: "insightType required" }, { status: 400 });

    const result = await generateInsights(env, {
      projectId: a.projectId,
      insightType: body.insightType,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      customData: body.customData,
      model: body.model,
    });
    return json(result, { status: result.ok ? 201 : (result.status || 500) });
  }

  // POST /ai-analytics/weekly-digest
  if (url.pathname === "/ai-analytics/weekly-digest" && request.method === "POST") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!hasAnyRole(a, ["owner", "admin"])) return new Response("Forbidden", { status: 403, headers: corsHeaders });
    const result = await generateWeeklyDigest(env, { projectId: a.projectId });
    return json(result, { status: 201 });
  }

  // GET /ai-analytics
  if (url.pathname === "/ai-analytics" && request.method === "GET") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const insightType = url.searchParams.get("type") || undefined;
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);
    const items = await listInsights(env, { projectId: a.projectId, insightType, limit, offset });
    return json({ items });
  }

  // GET /ai-analytics/:id
  const idMatch = url.pathname.match(/^\/ai-analytics\/([^/]+)$/);
  if (idMatch && request.method === "GET") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const id = decodeURIComponent(idMatch[1]);
    const item = await getInsight(env, { projectId: a.projectId, id });
    if (!item) return json({ error: "not_found" }, { status: 404 });
    return json(item);
  }

  // DELETE /ai-analytics/:id
  if (idMatch && request.method === "DELETE") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!hasAnyRole(a, ["owner", "admin"])) return new Response("Forbidden", { status: 403, headers: corsHeaders });
    const id = decodeURIComponent(idMatch[1]);
    const result = await deleteInsight(env, { projectId: a.projectId, id });
    if (!result.ok) return json({ error: result.error }, { status: result.error === "not_found" ? 404 : 500 });
    return json({ ok: true });
  }

  return null;
}

