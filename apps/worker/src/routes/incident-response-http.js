/**
 * P20-A: Incident Response HTTP Routes.
 *
 * Incidents: CRUD + timeline + postmortem
 * Alerts:    CRUD + acknowledge + link
 * Stats:     GET /incidents/stats
 */
import { pickRouteDeps } from "./route-http-deps.js";
import {
  createIncident, getIncident, listIncidents, updateIncident,
  addIncidentUpdate, getIncidentTimeline,
  ingestAlert, acknowledgeAlert, linkAlertToIncident, listAlerts,
  setPostmortem, getIncidentStats,
} from "../lib/incident-response.js";

export async function dispatchIncidentRoutes(request, url, h) {
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

  /* Incidents */
  if (url.pathname === "/incidents" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.title || !body?.roomId) return json({ error: "title and roomId required" }, { status: 400 });
    const inc = await createIncident(env, {
      projectId: auth.projectId, roomId: body.roomId, title: body.title,
      description: body.description, severity: body.severity,
      commanderId: body.commanderId, alertSource: body.alertSource,
      alertId: body.alertId, environment: body.environment, service: body.service,
    });
    return json(inc, { status: 201 });
  }

  if (url.pathname === "/incidents" && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const params = Object.fromEntries(url.searchParams);
    const incs = await listIncidents(env, {
      projectId: auth.projectId, roomId: params.roomId, status: params.status,
      severity: params.severity, limit: params.limit ? parseInt(params.limit) : 50,
    });
    return json({ incidents: incs, count: incs.length });
  }

  const incMatch = url.pathname.match(/^\/incidents\/([^/]+)$/);
  if (incMatch && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const inc = await getIncident(env, { projectId: auth.projectId, incidentId: decodeURIComponent(incMatch[1]) });
    if (!inc) return json({ error: "not_found" }, { status: 404 });
    return json(inc);
  }

  if (incMatch && request.method === "PATCH") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    const inc = await updateIncident(env, {
      projectId: auth.projectId, incidentId: decodeURIComponent(incMatch[1]),
      status: body?.status, severity: body?.severity,
      commanderId: body?.commanderId, oncallUserId: body?.oncallUserId,
    });
    return json(inc);
  }

  /* Timeline */
  const timelineMatch = url.pathname.match(/^\/incidents\/([^/]+)\/timeline$/);
  if (timelineMatch && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const timeline = await getIncidentTimeline(env, {
      projectId: auth.projectId, incidentId: decodeURIComponent(timelineMatch[1]),
    });
    return json({ timeline, count: timeline.length });
  }

  if (timelineMatch && request.method === "POST") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.content) return json({ error: "content required" }, { status: 400 });
    const update = await addIncidentUpdate(env, {
      projectId: auth.projectId, incidentId: decodeURIComponent(timelineMatch[1]),
      userId: auth.userId, updateType: body.updateType, content: body.content,
      metadata: body.metadata,
    });
    return json(update, { status: 201 });
  }

  /* Postmortem */
  const pmMatch = url.pathname.match(/^\/incidents\/([^/]+)\/postmortem$/);
  if (pmMatch && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    const inc = await setPostmortem(env, {
      projectId: auth.projectId, incidentId: decodeURIComponent(pmMatch[1]),
      postmortem: body?.postmortem, rootCause: body?.rootCause, actionItems: body?.actionItems,
    });
    return json(inc);
  }

  /* Alerts */
  if (url.pathname === "/incidents/alerts" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.roomId || !body?.source || !body?.title) {
      return json({ error: "roomId, source, and title required" }, { status: 400 });
    }
    const alert = await ingestAlert(env, {
      projectId: auth.projectId, roomId: body.roomId, source: body.source,
      alertType: body.alertType || "custom", title: body.title, payload: body.payload,
    });
    return json(alert, { status: 201 });
  }

  if (url.pathname === "/incidents/alerts" && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const params = Object.fromEntries(url.searchParams);
    const alerts = await listAlerts(env, {
      projectId: auth.projectId, roomId: params.roomId,
      status: params.status, limit: params.limit ? parseInt(params.limit) : 50,
    });
    return json({ alerts, count: alerts.length });
  }

  const ackMatch = url.pathname.match(/^\/incidents\/alerts\/([^/]+)\/acknowledge$/);
  if (ackMatch && request.method === "POST") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const ok = await acknowledgeAlert(env, {
      projectId: auth.projectId, alertId: decodeURIComponent(ackMatch[1]), userId: auth.userId,
    });
    return json({ ok });
  }

  const linkMatch = url.pathname.match(/^\/incidents\/alerts\/([^/]+)\/link\/([^/]+)$/);
  if (linkMatch && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const ok = await linkAlertToIncident(env, {
      projectId: auth.projectId,
      alertId: decodeURIComponent(linkMatch[1]),
      incidentId: decodeURIComponent(linkMatch[2]),
    });
    return json({ ok });
  }

  /* Stats */
  if (url.pathname === "/incidents/stats" && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const stats = await getIncidentStats(env, { projectId: auth.projectId });
    return json(stats);
  }

  return null;
}
