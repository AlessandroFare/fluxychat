/**
 * P19-A: Live Dashboards HTTP Routes.
 *
 * Dashboard CRUD:   POST/GET /enterprise/dashboards, GET/PATCH/DELETE /enterprise/dashboards/:id
 * Widget CRUD:      POST/GET /enterprise/dashboards/:id/widgets, GET/PATCH/DELETE /enterprise/widgets/:id
 * Data points:      POST /enterprise/widgets/:id/data, GET /enterprise/widgets/:id/data
 * Latest:           GET /enterprise/widgets/:id/latest
 * Auto-generate:    POST /enterprise/dashboards/default
 * Purge:            POST /enterprise/dashboards/purge
 */
import { pickRouteDeps } from "./route-http-deps.js";
import {
  createDashboard, getDashboard, listDashboards, updateDashboard, deleteDashboard,
  createWidget, getWidget, listWidgets, updateWidget, deleteWidget,
  pushDataPoint, pushBulkDataPoints, queryDataPoints, getWidgetLatest, purgeOldDataPoints,
  generateDefaultDashboard,
} from "../lib/live-dashboards.js";

export async function dispatchDashboardRoutes(request, url, h) {
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

  /* Dashboard CRUD */
  if (url.pathname === "/enterprise/dashboards" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.name) return json({ error: "name is required" }, { status: 400 });
    const dash = await createDashboard(env, {
      projectId: auth.projectId, name: body.name, description: body.description,
      layout: body.layout, refreshIntervalMs: body.refreshIntervalMs,
      isPublic: body.isPublic, ownerUserId: auth.userId,
    });
    return json(dash, { status: 201 });
  }

  if (url.pathname === "/enterprise/dashboards" && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const dashboards = await listDashboards(env, { projectId: auth.projectId });
    return json({ dashboards, count: dashboards.length });
  }

  if (url.pathname === "/enterprise/dashboards/default" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const result = await generateDefaultDashboard(env, { projectId: auth.projectId, ownerUserId: auth.userId });
    return json(result, { status: 201 });
  }

  if (url.pathname === "/enterprise/dashboards/purge" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.olderThan) return json({ error: "olderThan timestamp required" }, { status: 400 });
    const purged = await purgeOldDataPoints(env, { projectId: auth.projectId, olderThanTimestamp: body.olderThan });
    return json({ purged });
  }

  const dashMatch = url.pathname.match(/^\/enterprise\/dashboards\/([^/]+)$/);
  if (dashMatch && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const dash = await getDashboard(env, { projectId: auth.projectId, dashboardId: decodeURIComponent(dashMatch[1]) });
    if (!dash) return json({ error: "not_found" }, { status: 404 });
    const widgets = await listWidgets(env, { projectId: auth.projectId, dashboardId: dash.id });
    return json({ ...dash, widgets });
  }

  if (dashMatch && request.method === "PATCH") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    const dash = await updateDashboard(env, { projectId: auth.projectId, dashboardId: decodeURIComponent(dashMatch[1]), updates: body });
    if (!dash) return json({ error: "not_found" }, { status: 404 });
    return json(dash);
  }

  if (dashMatch && request.method === "DELETE") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const deleted = await deleteDashboard(env, { projectId: auth.projectId, dashboardId: decodeURIComponent(dashMatch[1]) });
    return json({ deleted });
  }

  /* Widget CRUD */
  const widgetsMatch = url.pathname.match(/^\/enterprise\/dashboards\/([^/]+)\/widgets$/);
  if (widgetsMatch && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.widgetType || !body?.title) return json({ error: "widgetType and title required" }, { status: 400 });
    const widget = await createWidget(env, {
      projectId: auth.projectId, dashboardId: decodeURIComponent(widgetsMatch[1]),
      widgetType: body.widgetType, title: body.title, config: body.config,
      positionX: body.positionX, positionY: body.positionY, width: body.width, height: body.height,
    });
    return json(widget, { status: 201 });
  }

  if (widgetsMatch && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const widgets = await listWidgets(env, { projectId: auth.projectId, dashboardId: decodeURIComponent(widgetsMatch[1]) });
    return json({ widgets, count: widgets.length });
  }

  const widgetMatch = url.pathname.match(/^\/enterprise\/widgets\/([^/]+)$/);
  if (widgetMatch && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const widget = await getWidget(env, { projectId: auth.projectId, widgetId: decodeURIComponent(widgetMatch[1]) });
    if (!widget) return json({ error: "not_found" }, { status: 404 });
    return json(widget);
  }

  if (widgetMatch && request.method === "PATCH") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    const widget = await updateWidget(env, { projectId: auth.projectId, widgetId: decodeURIComponent(widgetMatch[1]), updates: body });
    if (!widget) return json({ error: "not_found" }, { status: 404 });
    return json(widget);
  }

  if (widgetMatch && request.method === "DELETE") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const deleted = await deleteWidget(env, { projectId: auth.projectId, widgetId: decodeURIComponent(widgetMatch[1]) });
    return json({ deleted });
  }

  /* Data points */
  const dataMatch = url.pathname.match(/^\/enterprise\/widgets\/([^/]+)\/data$/);
  if (dataMatch && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (body?.points && Array.isArray(body.points)) {
      const result = await pushBulkDataPoints(env, { projectId: auth.projectId, dashboardId: null, points: body.points });
      return json(result, { status: 201 });
    }
    if (body?.value === undefined) return json({ error: "value required" }, { status: 400 });
    const widget = await getWidget(env, { projectId: auth.projectId, widgetId: decodeURIComponent(dataMatch[1]) });
    if (!widget) return json({ error: "widget not found" }, { status: 404 });
    const dp = await pushDataPoint(env, {
      projectId: auth.projectId, widgetId: widget.id, dashboardId: widget.dashboardId,
      seriesName: body.seriesName, value: body.value, label: body.label,
      timestamp: body.timestamp, metadata: body.metadata,
    });
    return json(dp, { status: 201 });
  }

  if (dataMatch && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const params = Object.fromEntries(url.searchParams);
    const points = await queryDataPoints(env, {
      projectId: auth.projectId, widgetId: decodeURIComponent(dataMatch[1]),
      seriesName: params.series, from: params.from, to: params.to,
      limit: params.limit ? parseInt(params.limit) : 100,
    });
    return json({ points, count: points.length });
  }

  const latestMatch = url.pathname.match(/^\/enterprise\/widgets\/([^/]+)\/latest$/);
  if (latestMatch && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const point = await getWidgetLatest(env, { projectId: auth.projectId, widgetId: decodeURIComponent(latestMatch[1]) });
    return json(point || { error: "no_data" }, { status: point ? 200 : 404 });
  }

  return null;
}
