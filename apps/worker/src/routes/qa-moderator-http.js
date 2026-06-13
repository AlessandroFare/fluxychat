/**
 * P19-F: AI Live Q&A Moderator HTTP Routes.
 *
 * POST /enterprise/qa/sessions          — start session
 * GET  /enterprise/qa/sessions/:id      — get session
 * POST /enterprise/qa/sessions/:id/end  — end session
 * POST /enterprise/qa/sessions/:id/questions — submit question
 * GET  /enterprise/qa/sessions/:id/queue — priority queue
 * GET  /enterprise/qa/sessions/:id/stats — stats
 * GET  /enterprise/qa/sessions/:id/questions — list questions
 * POST /enterprise/qa/questions/:id/approve
 * POST /enterprise/qa/questions/:id/dismiss
 * POST /enterprise/qa/questions/:id/merge
 */
import { pickRouteDeps } from "./route-http-deps.js";
import {
  startQASession, getQASession, endQASession, submitQuestion,
  getPriorityQueue, approveQuestion, dismissQuestion, mergeDuplicate,
  getQAStats, listQuestions,
} from "../lib/ai-qa-moderator.js";

export async function dispatchQAModeratorRoutes(request, url, h) {
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

  async function anyAuth() {
    return verifyJwtAndGetContext(request, env).catch(() => null);
  }

  if (url.pathname === "/enterprise/qa/sessions" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.eventId || !body?.roomId) return json({ error: "eventId and roomId required" }, { status: 400 });
    const session = await startQASession(env, {
      projectId: auth.projectId, eventId: body.eventId, roomId: body.roomId,
      aiModel: body.aiModel, dedupThreshold: body.dedupThreshold,
      maxQuestionsPerUser: body.maxQuestionsPerUser, settings: body.settings,
    });
    return json(session, { status: 201 });
  }

  const sessionMatch = url.pathname.match(/^\/enterprise\/qa\/sessions\/([^/]+)$/);
  if (sessionMatch && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const session = await getQASession(env, { projectId: auth.projectId, sessionId: decodeURIComponent(sessionMatch[1]) });
    if (!session) return json({ error: "not_found" }, { status: 404 });
    return json(session);
  }

  const endMatch = url.pathname.match(/^\/enterprise\/qa\/sessions\/([^/]+)\/end$/);
  if (endMatch && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const ok = await endQASession(env, { projectId: auth.projectId, sessionId: decodeURIComponent(endMatch[1]) });
    return json({ ok });
  }

  const questionsMatch = url.pathname.match(/^\/enterprise\/qa\/sessions\/([^/]+)\/questions$/);
  if (questionsMatch && request.method === "POST") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.question) return json({ error: "question required" }, { status: 400 });
    const result = await submitQuestion(env, {
      projectId: auth.projectId, sessionId: decodeURIComponent(questionsMatch[1]),
      eventId: body.eventId, userId: auth.userId, question: body.question,
    });
    return json(result, { status: 201 });
  }

  if (questionsMatch && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const params = Object.fromEntries(url.searchParams);
    const questions = await listQuestions(env, {
      projectId: auth.projectId, sessionId: decodeURIComponent(questionsMatch[1]),
      status: params.status, limit: params.limit ? parseInt(params.limit) : 50,
    });
    return json({ questions, count: questions.length });
  }

  const queueMatch = url.pathname.match(/^\/enterprise\/qa\/sessions\/([^/]+)\/queue$/);
  if (queueMatch && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const params = Object.fromEntries(url.searchParams);
    const queue = await getPriorityQueue(env, {
      projectId: auth.projectId, sessionId: decodeURIComponent(queueMatch[1]),
      limit: params.limit ? parseInt(params.limit) : 50,
    });
    return json({ queue, count: queue.length });
  }

  const statsMatch = url.pathname.match(/^\/enterprise\/qa\/sessions\/([^/]+)\/stats$/);
  if (statsMatch && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const stats = await getQAStats(env, {
      projectId: auth.projectId, sessionId: decodeURIComponent(statsMatch[1]),
    });
    return json(stats);
  }

  const approveMatch = url.pathname.match(/^\/enterprise\/qa\/questions\/([^/]+)\/approve$/);
  if (approveMatch && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const ok = await approveQuestion(env, { projectId: auth.projectId, questionId: decodeURIComponent(approveMatch[1]) });
    return json({ ok });
  }

  const dismissMatch = url.pathname.match(/^\/enterprise\/qa\/questions\/([^/]+)\/dismiss$/);
  if (dismissMatch && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const ok = await dismissQuestion(env, { projectId: auth.projectId, questionId: decodeURIComponent(dismissMatch[1]) });
    return json({ ok });
  }

  const mergeMatch = url.pathname.match(/^\/enterprise\/qa\/questions\/([^/]+)\/merge$/);
  if (mergeMatch && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.targetId) return json({ error: "targetId required" }, { status: 400 });
    const ok = await mergeDuplicate(env, {
      projectId: auth.projectId, questionId: decodeURIComponent(mergeMatch[1]), targetId: body.targetId,
    });
    return json({ ok });
  }

  return null;
}
