import { pickRouteDeps } from "./route-http-deps.js";
import { canModerateQueue } from "../lib/moderation-queue.js";
import {
  getPriorityQueue,
  bulkReviewEvents,
  submitFeedback,
  getFeedbackStats,
  getSlaConfigs,
  upsertSlaConfig,
  scanSlaBreaches,
  getUnresolvedBreaches,
  resolveBreach,
  getReviewHistory,
} from "../lib/moderation-queue.js";

export async function dispatchModerationQueueRoutes(request, url, h) {
  const {
    env, json, corsHeaders, requestLogCtx,
    verifyJwtAndGetContext, logError,
  } = pickRouteDeps(h, ["env", "json", "corsHeaders", "requestLogCtx", "verifyJwtAndGetContext", "logError"]);

  /* ── GET /moderation-queue/priority ── */
  if (url.pathname === "/moderation-queue/priority" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!canModerateQueue(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    const params = url.searchParams;
    const roomId = params.get("room_id") || undefined;
    const severity = params.get("severity") || undefined;
    const pending = params.get("pending") === "true";
    const limit = Math.min(200, Math.max(1, parseInt(params.get("limit") || "20", 10)));
    const offset = Math.max(0, parseInt(params.get("offset") || "0", 10));
    const result = await getPriorityQueue(env, { projectId: auth.projectId, roomId, severity, pending, limit, offset });
    return json(result, { headers: corsHeaders });
  }

  /* ── POST /moderation-queue/bulk-review ── */
  if (url.pathname === "/moderation-queue/bulk-review" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!canModerateQueue(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    let body;
    try { body = await request.json(); } catch { return json({ error: "invalid_json" }, { status: 400, headers: corsHeaders }); }
    const { eventIds, action, overrideAction, notes } = body || {};
    if (!eventIds || !action) return json({ error: "eventIds and action required" }, { status: 400, headers: corsHeaders });
    const result = await bulkReviewEvents(env, {
      projectId: auth.projectId, eventIds, moderatorId: auth.userId, action, overrideAction, notes
    });
    return json(result, { headers: corsHeaders });
  }

  /* ── POST /moderation-queue/feedback ── */
  if (url.pathname === "/moderation-queue/feedback" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!canModerateQueue(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    let body;
    try { body = await request.json(); } catch { return json({ error: "invalid_json" }, { status: 400, headers: corsHeaders }); }
    const { queueEventId, feedbackType, reason, categoryAccuracy } = body || {};
    if (!queueEventId || !feedbackType) return json({ error: "queueEventId and feedbackType required" }, { status: 400, headers: corsHeaders });
    const result = await submitFeedback(env, {
      projectId: auth.projectId, queueEventId, moderatorId: auth.userId, feedbackType, reason, categoryAccuracy
    });
    return json(result, { headers: corsHeaders });
  }

  /* ── GET /moderation-queue/feedback/stats ── */
  if (url.pathname === "/moderation-queue/feedback/stats" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!canModerateQueue(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get("days") || "30", 10)));
    const result = await getFeedbackStats(env, { projectId: auth.projectId, days });
    return json(result, { headers: corsHeaders });
  }

  /* ── GET /moderation-queue/sla-config ── */
  if (url.pathname === "/moderation-queue/sla-config" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!canModerateQueue(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    const configs = await getSlaConfigs(env, { projectId: auth.projectId });
    return json({ configs }, { headers: corsHeaders });
  }

  /* ── POST /moderation-queue/sla-config ── */
  if (url.pathname === "/moderation-queue/sla-config" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!canModerateQueue(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    let body;
    try { body = await request.json(); } catch { return json({ error: "invalid_json" }, { status: 400, headers: corsHeaders }); }
    const { severity, slaMinutes, escalationEnabled, escalationSeverity } = body || {};
    if (!severity) return json({ error: "severity required" }, { status: 400, headers: corsHeaders });
    const result = await upsertSlaConfig(env, { projectId: auth.projectId, severity, slaMinutes, escalationEnabled, escalationSeverity });
    return json(result, { headers: corsHeaders });
  }

  /* ── POST /moderation-queue/sla-scan ── */
  if (url.pathname === "/moderation-queue/sla-scan" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!canModerateQueue(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    const result = await scanSlaBreaches(env, { projectId: auth.projectId });
    return json(result, { headers: corsHeaders });
  }

  /* ── GET /moderation-queue/sla-breaches ── */
  if (url.pathname === "/moderation-queue/sla-breaches" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!canModerateQueue(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    const breaches = await getUnresolvedBreaches(env, { projectId: auth.projectId });
    return json({ breaches }, { headers: corsHeaders });
  }

  /* ── POST /moderation-queue/sla-breaches/:id/resolve ── */
  if (url.pathname.startsWith("/moderation-queue/sla-breaches/") && url.pathname.endsWith("/resolve") && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!canModerateQueue(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    const breachId = url.pathname.split("/")[3];
    const result = await resolveBreach(env, { projectId: auth.projectId, breachId });
    return json(result, { headers: corsHeaders });
  }

  /* ── GET /moderation-queue/review-history ── */
  if (url.pathname === "/moderation-queue/review-history" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!canModerateQueue(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    const params = url.searchParams;
    const moderatorId = params.get("moderator_id") || undefined;
    const limit = Math.min(200, Math.max(1, parseInt(params.get("limit") || "50", 10)));
    const offset = Math.max(0, parseInt(params.get("offset") || "0", 10));
    const history = await getReviewHistory(env, { projectId: auth.projectId, moderatorId, limit, offset });
    return json({ history }, { headers: corsHeaders });
  }

  return null;
}
