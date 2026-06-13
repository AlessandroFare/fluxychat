import { pickRouteDeps } from "./route-http-deps.js";
import {
  getModerationQueue,
  reviewModerationEvent,
  getModerationStats,
  analyzeContent,
  queueModerationEvent,
  applyAutoAction,
} from "../lib/ai-moderation.js";
import { workerSharedLlmAllowed } from "../lib/hosted-saas-policy.js";

export async function dispatchAiModerationRoutes(request, url, h) {
  const path = url.pathname;

  if (path === "/admin/moderation/queue" && request.method === "GET") {
    return dispatchGetQueue(request, url, h);
  }
  if (path === "/admin/moderation/review" && request.method === "POST") {
    return dispatchReview(request, url, h);
  }
  if (path === "/admin/moderation/stats" && request.method === "GET") {
    return dispatchStats(request, url, h);
  }
  if (path === "/admin/moderation/analyze" && request.method === "POST") {
    return dispatchAnalyze(request, url, h);
  }
  return null;
}

async function dispatchGetQueue(request, url, h) {
  const {
    env, json, corsHeaders, requestLogCtx,
    verifyJwtAndGetContext, logError,
  } = pickRouteDeps(h, [
    "env", "json", "corsHeaders", "requestLogCtx",
    "verifyJwtAndGetContext", "logError",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  if (!auth.roles?.includes("admin") && !auth.roles?.includes("moderator")) {
    return json({ error: "moderator_role_required" }, { status: 403, headers: corsHeaders });
  }

  const roomId = url.searchParams.get("roomId")?.trim() || null;
  const severity = url.searchParams.get("severity")?.trim() || null;
  const pending = url.searchParams.get("pending") === "true";
  const limit = url.searchParams.get("limit");
  const offset = url.searchParams.get("offset");

  const result = await getModerationQueue(env, {
    projectId: auth.projectId,
    roomId,
    severity,
    pending: pending || undefined,
    limit: limit ? Number(limit) : undefined,
    offset: offset ? Number(offset) : undefined,
  });

  return json(result, { headers: corsHeaders });
}

async function dispatchReview(request, url, h) {
  const {
    env, json, corsHeaders, requestLogCtx,
    verifyJwtAndGetContext, logError,
  } = pickRouteDeps(h, [
    "env", "json", "corsHeaders", "requestLogCtx",
    "verifyJwtAndGetContext", "logError",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  if (!auth.roles?.includes("admin") && !auth.roles?.includes("moderator")) {
    return json({ error: "moderator_role_required" }, { status: 403, headers: corsHeaders });
  }

  let body;
  try { body = await request.json(); } catch {
    return json({ error: "invalid_json" }, { status: 400, headers: corsHeaders });
  }

  const { eventId, action, overrideAction, notes } = body;
  if (!eventId || !action) {
    return json({ error: "eventId_and_action_required" }, { status: 400, headers: corsHeaders });
  }

  if (!["confirm", "override", "dismiss"].includes(action)) {
    return json({ error: "invalid_action" }, { status: 400, headers: corsHeaders });
  }

  const result = await reviewModerationEvent(env, {
    eventId,
    projectId: auth.projectId,
    moderatorId: auth.userId,
    action,
    overrideAction,
    notes,
  });

  if (!result.ok) {
    return json({ error: result.error }, { status: 404, headers: corsHeaders });
  }

  return json({ ok: true }, { headers: corsHeaders });
}

async function dispatchStats(request, url, h) {
  const {
    env, json, corsHeaders, requestLogCtx,
    verifyJwtAndGetContext, logError,
  } = pickRouteDeps(h, [
    "env", "json", "corsHeaders", "requestLogCtx",
    "verifyJwtAndGetContext", "logError",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  if (!auth.roles?.includes("admin") && !auth.roles?.includes("moderator")) {
    return json({ error: "moderator_role_required" }, { status: 403, headers: corsHeaders });
  }

  const days = url.searchParams.get("days");

  const result = await getModerationStats(env, {
    projectId: auth.projectId,
    days: days ? Number(days) : undefined,
  });

  return json(result, { headers: corsHeaders });
}

async function dispatchAnalyze(request, url, h) {
  const {
    env, json, corsHeaders, requestLogCtx,
    verifyJwtAndGetContext, logError, isValidId,
  } = pickRouteDeps(h, [
    "env", "json", "corsHeaders", "requestLogCtx",
    "verifyJwtAndGetContext", "logError", "isValidId",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  if (!auth.roles?.includes("admin") && !auth.roles?.includes("moderator")) {
    return json({ error: "moderator_role_required" }, { status: 403, headers: corsHeaders });
  }

  if (!workerSharedLlmAllowed(env, auth.projectId)) {
    return json({ error: "llm_not_allowed" }, { status: 403, headers: corsHeaders });
  }

  let body;
  try { body = await request.json(); } catch {
    return json({ error: "invalid_json" }, { status: 400, headers: corsHeaders });
  }

  const { content, roomId, userId, messageId } = body;
  if (!content || !roomId || !userId) {
    return json({ error: "content_roomId_userId_required" }, { status: 400, headers: corsHeaders });
  }

  const analysis = await analyzeContent(env, {
    content,
    projectId: auth.projectId,
    roomId,
    userId,
    messageId: messageId ? Number(messageId) : undefined,
  });

  if (!analysis.ok) {
    const status = analysis.error === "ai_not_configured" ? 503 : 500;
    return json({ error: analysis.error }, { status, headers: corsHeaders });
  }

  return json(analysis, { headers: corsHeaders });
}
