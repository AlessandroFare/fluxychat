/**
 * P18-H: SLA Monitoring HTTP Routes + P18-I: Predictive Engagement HTTP Routes.
 *
 * SLA:   POST /enterprise/slo/definitions, GET /enterprise/slo/definitions
 *        POST /enterprise/slo/data, GET /enterprise/slo/:id/status
 *        GET /enterprise/slo/alerts, GET /enterprise/status-page
 *
 * Engage: POST /enterprise/engagement/activity, GET /enterprise/engagement/activity/:userId
 *         GET /enterprise/engagement/churn/:userId, GET /enterprise/engagement/send-time/:userId
 *         GET /enterprise/engagement/forecast/:userId, GET /enterprise/engagement/churn-analysis
 */
import { pickRouteDeps } from "./route-http-deps.js";
import {
  createSloDefinition,
  listSloDefinitions,
  recordSliDataPoint,
  calculateSlaStatus,
  checkErrorBudgetAlerts,
  getStatusPageData,
} from "../lib/sla-monitoring.js";
import {
  recordUserActivity,
  getUserActivityLog,
  predictChurnRisk,
  calculateOptimalSendTime,
  forecastActivity,
  analyzeProjectChurn,
} from "../lib/predictive-engagement.js";

export async function dispatchSlaAndEngagementRoutes(request, url, h) {
  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
    hasAnyRole,
  } = pickRouteDeps(h, [
    "env", "json", "corsHeaders", "requestLogCtx",
    "verifyJwtAndGetContext", "logError", "hasAnyRole",
  ]);

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

  /* ═══ SLA / SLO Routes ═══ */

  if (url.pathname === "/enterprise/slo/definitions" && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const slos = await listSloDefinitions(env, { projectId: auth.projectId });
    return json({ slos, count: slos.length });
  }

  if (url.pathname === "/enterprise/slo/definitions" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.name) return json({ error: "name is required" }, { status: 400 });
    const slo = await createSloDefinition(env, {
      projectId: auth.projectId, name: body.name, target: body.target,
      windowDays: body.windowDays, metricType: body.metricType, description: body.description,
    });
    return json(slo, { status: 201 });
  }

  if (url.pathname === "/enterprise/slo/data" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.sloId || body?.value === undefined) return json({ error: "sloId and value are required" }, { status: 400 });
    const dp = await recordSliDataPoint(env, {
      projectId: auth.projectId, sloId: body.sloId, value: body.value,
      timestamp: body.timestamp, metadata: body.metadata,
    });
    return json(dp, { status: 201 });
  }

  const sloStatusMatch = url.pathname.match(/^\/enterprise\/slo\/([^/]+)\/status$/);
  if (sloStatusMatch && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const sloId = decodeURIComponent(sloStatusMatch[1]);
    const status = await calculateSlaStatus(env, { projectId: auth.projectId, sloId });
    if (!status) return json({ error: "not_found" }, { status: 404 });
    return json(status);
  }

  if (url.pathname === "/enterprise/slo/alerts" && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const alerts = await checkErrorBudgetAlerts(env, { projectId: auth.projectId });
    return json({ alerts, count: alerts.length });
  }

  if (url.pathname === "/enterprise/status-page" && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const page = await getStatusPageData(env, { projectId: auth.projectId });
    return json(page);
  }

  /* ═══ Predictive Engagement Routes ═══ */

  if (url.pathname === "/enterprise/engagement/activity" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.userId || !body?.activityType) return json({ error: "userId and activityType are required" }, { status: 400 });
    const act = await recordUserActivity(env, {
      projectId: auth.projectId, userId: body.userId, roomId: body.roomId,
      activityType: body.activityType, timestamp: body.timestamp, metadata: body.metadata,
    });
    return json(act, { status: 201 });
  }

  const activityMatch = url.pathname.match(/^\/enterprise\/engagement\/activity\/([^/]+)$/);
  if (activityMatch && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const userId = decodeURIComponent(activityMatch[1]);
    const log = await getUserActivityLog(env, { projectId: auth.projectId, userId });
    return json({ activities: log, count: log.length });
  }

  const churnMatch = url.pathname.match(/^\/enterprise\/engagement\/churn\/([^/]+)$/);
  if (churnMatch && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const userId = decodeURIComponent(churnMatch[1]);
    const prediction = await predictChurnRisk(env, { projectId: auth.projectId, userId });
    return json(prediction);
  }

  const sendTimeMatch = url.pathname.match(/^\/enterprise\/engagement\/send-time\/([^/]+)$/);
  if (sendTimeMatch && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const userId = decodeURIComponent(sendTimeMatch[1]);
    const result = await calculateOptimalSendTime(env, { projectId: auth.projectId, userId });
    return json(result);
  }

  const forecastMatch = url.pathname.match(/^\/enterprise\/engagement\/forecast\/([^/]+)$/);
  if (forecastMatch && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const userId = decodeURIComponent(forecastMatch[1]);
    const result = await forecastActivity(env, { projectId: auth.projectId, userId });
    return json(result);
  }

  if (url.pathname === "/enterprise/engagement/churn-analysis" && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const analysis = await analyzeProjectChurn(env, { projectId: auth.projectId });
    return json(analysis);
  }

  return null;
}
