import { pickRouteDeps } from "./route-http-deps.js";
import { canAccessAgentQueue } from "../lib/agent-queue.js";
import {
  canViewIntelligence,
  storeQuestion,
  markQuestionAnswered,
  markUnansweredQuestions,
  listQuestions,
  getQuestionStats,
  upsertIntentCluster,
  getIntentClusters,
  getTopIntents,
  getEscalationReasons,
  getResolutionTimes,
  getModerationTrends,
  createSnapshot,
  getSnapshots,
  generateWeeklyDigest,
} from "../lib/conversation-intelligence.js";

export async function dispatchIntelligenceRoutes(request, url, h) {
  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "logError",
  ]);

  /* ── GET /intelligence/questions ── */
  if (url.pathname === "/intelligence/questions" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!canViewIntelligence(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    const params = url.searchParams;
    const roomId = params.get("room_id") || undefined;
    const status = params.get("status") || undefined;
    const limit = Math.min(200, Math.max(1, parseInt(params.get("limit") || "50", 10)));
    const offset = Math.max(0, parseInt(params.get("offset") || "0", 10));
    const questions = await listQuestions(env.DB, { projectId: auth.projectId, roomId, status, limit, offset });
    return json({ questions }, { headers: corsHeaders });
  }

  /* ── GET /intelligence/questions/stats ── */
  if (url.pathname === "/intelligence/questions/stats" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!canViewIntelligence(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    const params = url.searchParams;
    const roomId = params.get("room_id") || undefined;
    const periodStart = params.get("period_start") || undefined;
    const periodEnd = params.get("period_end") || undefined;
    const stats = await getQuestionStats(env.DB, { projectId: auth.projectId, roomId, periodStart, periodEnd });
    return json({ stats }, { headers: corsHeaders });
  }

  /* ── POST /intelligence/questions/mark-answered ── */
  if (url.pathname === "/intelligence/questions/mark-answered" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!canViewIntelligence(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    let body;
    try { body = await request.json(); } catch { return json({ error: "invalid_json" }, { status: 400, headers: corsHeaders }); }
    const { messageId, answerMessageId, answerAgentId } = body || {};
    if (!messageId) return json({ error: "messageId required" }, { status: 400, headers: corsHeaders });
    const updated = await markQuestionAnswered(env.DB, {
      projectId: auth.projectId, messageId, answerMessageId, answerAgentId
    });
    return json({ updated }, { headers: corsHeaders });
  }

  /* ── POST /intelligence/questions/mark-unanswered ── */
  if (url.pathname === "/intelligence/questions/mark-unanswered" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!canViewIntelligence(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    let body;
    try { body = await request.json(); } catch { return json({ error: "invalid_json" }, { status: 400, headers: corsHeaders }); }
    const { roomId, olderThanMinutes } = body || {};
    if (!roomId) return json({ error: "roomId required" }, { status: 400, headers: corsHeaders });
    const updated = await markUnansweredQuestions(env.DB, {
      projectId: auth.projectId, roomId, olderThanMinutes
    });
    return json({ updated }, { headers: corsHeaders });
  }

  /* ── GET /intelligence/intents ── */
  if (url.pathname === "/intelligence/intents" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!canViewIntelligence(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    const params = url.searchParams;
    const roomId = params.get("room_id") || undefined;
    const limit = Math.min(200, Math.max(1, parseInt(params.get("limit") || "50", 10)));
    const offset = Math.max(0, parseInt(params.get("offset") || "0", 10));
    const minFrequency = Math.max(1, parseInt(params.get("min_frequency") || "1", 10));
    const intents = await getIntentClusters(env.DB, { projectId: auth.projectId, roomId, limit, offset, minFrequency });
    return json({ intents }, { headers: corsHeaders });
  }

  /* ── GET /intelligence/intents/top ── */
  if (url.pathname === "/intelligence/intents/top" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!canViewIntelligence(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    const params = url.searchParams;
    const roomId = params.get("room_id") || undefined;
    const limit = Math.min(50, Math.max(1, parseInt(params.get("limit") || "10", 10)));
    const intents = await getTopIntents(env.DB, { projectId: auth.projectId, roomId, limit });
    return json({ intents }, { headers: corsHeaders });
  }

  /* ── GET /intelligence/analytics/escalations ── */
  if (url.pathname === "/intelligence/analytics/escalations" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!canViewIntelligence(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    const params = url.searchParams;
    const roomId = params.get("room_id") || undefined;
    const periodStart = params.get("period_start") || undefined;
    const periodEnd = params.get("period_end") || undefined;
    const reasons = await getEscalationReasons(env.DB, { projectId: auth.projectId, roomId, periodStart, periodEnd });
    return json({ reasons }, { headers: corsHeaders });
  }

  /* ── GET /intelligence/analytics/resolution-times ── */
  if (url.pathname === "/intelligence/analytics/resolution-times" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!canViewIntelligence(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    const params = url.searchParams;
    const roomId = params.get("room_id") || undefined;
    const periodStart = params.get("period_start") || undefined;
    const periodEnd = params.get("period_end") || undefined;
    const times = await getResolutionTimes(env.DB, { projectId: auth.projectId, roomId, periodStart, periodEnd });
    return json({ times }, { headers: corsHeaders });
  }

  /* ── GET /intelligence/analytics/moderation ── */
  if (url.pathname === "/intelligence/analytics/moderation" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!canViewIntelligence(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    const params = url.searchParams;
    const roomId = params.get("room_id") || undefined;
    const periodStart = params.get("period_start") || undefined;
    const periodEnd = params.get("period_end") || undefined;
    const trends = await getModerationTrends(env.DB, { projectId: auth.projectId, roomId, periodStart, periodEnd });
    return json({ trends }, { headers: corsHeaders });
  }

  /* ── GET /intelligence/digest ── */
  if (url.pathname === "/intelligence/digest" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!canViewIntelligence(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    const params = url.searchParams;
    const periodStart = params.get("period_start") || new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
    const periodEnd = params.get("period_end") || new Date().toISOString();
    const digest = await generateWeeklyDigest(env.DB, { projectId: auth.projectId, periodStart, periodEnd });
    return json({ digest }, { headers: corsHeaders });
  }

  /* ── GET /intelligence/snapshots ── */
  if (url.pathname === "/intelligence/snapshots" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!canViewIntelligence(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    const params = url.searchParams;
    const snapshotType = params.get("type") || undefined;
    const roomId = params.get("room_id") || undefined;
    const limit = Math.min(200, Math.max(1, parseInt(params.get("limit") || "50", 10)));
    const snapshots = await getSnapshots(env.DB, { projectId: auth.projectId, snapshotType, roomId, limit });
    return json({ snapshots }, { headers: corsHeaders });
  }

  /* ── POST /intelligence/snapshots ── */
  if (url.pathname === "/intelligence/snapshots" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!canViewIntelligence(auth.roles)) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    let body;
    try { body = await request.json(); } catch { return json({ error: "invalid_json" }, { status: 400, headers: corsHeaders }); }
    const { snapshotType, data, periodStart, periodEnd, roomId } = body || {};
    if (!snapshotType || !data || !periodStart || !periodEnd) {
      return json({ error: "snapshotType, data, periodStart, periodEnd required" }, { status: 400, headers: corsHeaders });
    }
    const snapshot = await createSnapshot(env.DB, { projectId: auth.projectId, snapshotType, data, periodStart, periodEnd, roomId });
    return json({ snapshot }, { headers: corsHeaders });
  }

  return null;
}
