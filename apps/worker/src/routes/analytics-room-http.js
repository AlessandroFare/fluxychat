/**
 * P20-C: Live Analytics Room HTTP Routes.
 *
 * KPIs:  CRUD + values + aggregation
 * Room:  GET /analytics/rooms/:roomId
 */
import { pickRouteDeps } from "./route-http-deps.js";
import {
  createKpi, getKpi, listKpis, updateKpiValue,
  getKpiValues, getKpiAggregation, deleteKpi, getRoomAnalytics,
} from "../lib/room-analytics.js";

export async function dispatchAnalyticsRoomRoutes(request, url, h) {
  const {
    env, json, corsHeaders, requestLogCtx,
    verifyJwtAndGetContext, logError, hasAnyRole,
  } = pickRouteDeps(h, ["env", "json", "corsHeaders", "requestLogCtx", "verifyJwtAndGetContext", "logError", "hasAnyRole"]);

  async function adminAuth() {
    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) return null;
    if (!hasAnyRole(auth.roles, ["owner", "admin"])) return null;
    return auth;
  }

  async function anyAuth() {
    return verifyJwtAndGetContext(request, env).catch(() => null);
  }

  /* KPIs */
  if (url.pathname === "/analytics/kpis" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.name || !body?.roomId) return json({ error: "name and roomId required" }, { status: 400 });
    const kpi = await createKpi(env, {
      projectId: auth.projectId, roomId: body.roomId, name: body.name,
      description: body.description, kpiType: body.kpiType, source: body.source,
      config: body.config, unit: body.unit, target: body.target,
    });
    return json(kpi, { status: 201 });
  }

  if (url.pathname === "/analytics/kpis" && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const params = Object.fromEntries(url.searchParams);
    if (!params.roomId) return json({ error: "roomId required" }, { status: 400 });
    const kpis = await listKpis(env, { projectId: auth.projectId, roomId: params.roomId });
    return json({ kpis, count: kpis.length });
  }

  const kpiMatch = url.pathname.match(/^\/analytics\/kpis\/([^/]+)$/);
  if (kpiMatch && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const kpi = await getKpi(env, { projectId: auth.projectId, kpiId: decodeURIComponent(kpiMatch[1]) });
    if (!kpi) return json({ error: "not_found" }, { status: 404 });
    return json(kpi);
  }

  if (kpiMatch && request.method === "DELETE") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const ok = await deleteKpi(env, { projectId: auth.projectId, kpiId: decodeURIComponent(kpiMatch[1]) });
    return json({ ok });
  }

  /* KPI Values */
  if (url.pathname === "/analytics/kpis/values" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.kpiId || body?.value === undefined) return json({ error: "kpiId and value required" }, { status: 400 });
    const result = await updateKpiValue(env, {
      projectId: auth.projectId, kpiId: body.kpiId,
      value: body.value, metadata: body.metadata,
    });
    return json(result, { status: 201 });
  }

  const valuesMatch = url.pathname.match(/^\/analytics\/kpis\/([^/]+)\/values$/);
  if (valuesMatch && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const params = Object.fromEntries(url.searchParams);
    const values = await getKpiValues(env, {
      projectId: auth.projectId, kpiId: decodeURIComponent(valuesMatch[1]),
      limit: params.limit ? parseInt(params.limit) : 100, since: params.since,
    });
    return json({ values, count: values.length });
  }

  const aggMatch = url.pathname.match(/^\/analytics\/kpis\/([^/]+)\/aggregate$/);
  if (aggMatch && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const params = Object.fromEntries(url.searchParams);
    const result = await getKpiAggregation(env, {
      projectId: auth.projectId, kpiId: decodeURIComponent(aggMatch[1]),
      aggregation: params.aggregation || "avg", since: params.since,
    });
    return json(result);
  }

  /* Room Analytics Summary */
  const roomMatch = url.pathname.match(/^\/analytics\/rooms\/([^/]+)$/);
  if (roomMatch && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const summary = await getRoomAnalytics(env, {
      projectId: auth.projectId, roomId: decodeURIComponent(roomMatch[1]),
    });
    return json(summary);
  }

  return null;
}
