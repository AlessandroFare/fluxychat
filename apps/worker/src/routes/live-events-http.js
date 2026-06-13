/**
 * P19-B: Live Event Interactions HTTP Routes.
 *
 * Events:     POST/GET /enterprise/events, GET/PATCH /enterprise/events/:id
 * Q&A:        POST /enterprise/events/:id/questions, POST /enterprise/questions/:id/upvote
 *             POST /enterprise/questions/:id/approve, POST /enterprise/questions/:id/answer
 *             POST /enterprise/questions/:id/dismiss, GET /enterprise/events/:id/questions
 * Speakers:   POST /enterprise/events/:id/speakers, POST /enterprise/speakers/:id/accept
 *             POST /enterprise/speakers/:id/join, POST /enterprise/speakers/:id/leave
 *             GET /enterprise/events/:id/speakers, GET /enterprise/events/:id/speaker-queue
 * Reactions:  POST /enterprise/events/:id/reactions, GET /enterprise/events/:id/reactions
 * Stats:      GET /enterprise/events/:id/stats
 */
import { pickRouteDeps } from "./route-http-deps.js";
import {
  createEvent, getEvent, listEvents, startEvent, endEvent,
  submitQuestion, upvoteQuestion, approveQuestion, answerQuestion, dismissQuestion,
  listQuestions, getQaStats,
  inviteSpeaker, acceptSpeakerInvite, joinAsSpeaker, leaveSpeaker,
  listSpeakers, getSpeakerQueue,
  addReaction, getReactionSummary, clearOldReactions,
  getEventStats,
} from "../lib/live-events.js";

export async function dispatchLiveEventRoutes(request, url, h) {
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

  /* Events CRUD */
  if (url.pathname === "/enterprise/events" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.title || !body?.roomId) return json({ error: "title and roomId required" }, { status: 400 });
    const event = await createEvent(env, {
      projectId: auth.projectId, roomId: body.roomId, eventType: body.eventType,
      title: body.title, description: body.description, maxParticipants: body.maxParticipants,
      settings: body.settings,
    });
    return json(event, { status: 201 });
  }

  if (url.pathname === "/enterprise/events" && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const params = Object.fromEntries(url.searchParams);
    const events = await listEvents(env, { projectId: auth.projectId, status: params.status });
    return json({ events, count: events.length });
  }

  const eventMatch = url.pathname.match(/^\/enterprise\/events\/([^/]+)$/);
  if (eventMatch && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const event = await getEvent(env, { projectId: auth.projectId, eventId: decodeURIComponent(eventMatch[1]) });
    if (!event) return json({ error: "not_found" }, { status: 404 });
    return json(event);
  }

  if (eventMatch && request.method === "PATCH") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    const eventId = decodeURIComponent(eventMatch[1]);
    if (body?.action === "start") {
      const event = await startEvent(env, { projectId: auth.projectId, eventId });
      if (!event) return json({ error: "cannot_start" }, { status: 400 });
      return json(event);
    }
    if (body?.action === "end") {
      const event = await endEvent(env, { projectId: auth.projectId, eventId });
      if (!event) return json({ error: "cannot_end" }, { status: 400 });
      return json(event);
    }
    return json({ error: "invalid_action" }, { status: 400 });
  }

  /* Q&A */
  const questionsMatch = url.pathname.match(/^\/enterprise\/events\/([^/]+)\/questions$/);
  if (questionsMatch && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.question) return json({ error: "question required" }, { status: 400 });
    const q = await submitQuestion(env, {
      projectId: auth.projectId, eventId: decodeURIComponent(questionsMatch[1]),
      userId: auth.userId, question: body.question,
    });
    return json(q, { status: 201 });
  }

  if (questionsMatch && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const params = Object.fromEntries(url.searchParams);
    const questions = await listQuestions(env, {
      projectId: auth.projectId, eventId: decodeURIComponent(questionsMatch[1]),
      status: params.status, limit: params.limit ? parseInt(params.limit) : 50,
    });
    return json({ questions, count: questions.length });
  }

  const upvoteMatch = url.pathname.match(/^\/enterprise\/questions\/([^/]+)\/upvote$/);
  if (upvoteMatch && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const ok = await upvoteQuestion(env, { projectId: auth.projectId, questionId: decodeURIComponent(upvoteMatch[1]) });
    return json({ ok });
  }

  const approveMatch = url.pathname.match(/^\/enterprise\/questions\/([^/]+)\/approve$/);
  if (approveMatch && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const ok = await approveQuestion(env, { projectId: auth.projectId, questionId: decodeURIComponent(approveMatch[1]) });
    return json({ ok });
  }

  const answerMatch = url.pathname.match(/^\/enterprise\/questions\/([^/]+)\/answer$/);
  if (answerMatch && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.answer) return json({ error: "answer required" }, { status: 400 });
    const ok = await answerQuestion(env, {
      projectId: auth.projectId, questionId: decodeURIComponent(answerMatch[1]),
      answer: body.answer, answeredBy: auth.userId,
    });
    return json({ ok });
  }

  const dismissMatch = url.pathname.match(/^\/enterprise\/questions\/([^/]+)\/dismiss$/);
  if (dismissMatch && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const ok = await dismissQuestion(env, { projectId: auth.projectId, questionId: decodeURIComponent(dismissMatch[1]) });
    return json({ ok });
  }

  /* Speakers */
  const speakersMatch = url.pathname.match(/^\/enterprise\/events\/([^/]+)\/speakers$/);
  if (speakersMatch && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.userId) return json({ error: "userId required" }, { status: 400 });
    const speaker = await inviteSpeaker(env, {
      projectId: auth.projectId, eventId: decodeURIComponent(speakersMatch[1]),
      userId: body.userId, role: body.role,
    });
    return json(speaker, { status: 201 });
  }

  if (speakersMatch && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const params = Object.fromEntries(url.searchParams);
    const speakers = await listSpeakers(env, {
      projectId: auth.projectId, eventId: decodeURIComponent(speakersMatch[1]), status: params.status,
    });
    return json({ speakers, count: speakers.length });
  }

  const speakerQueueMatch = url.pathname.match(/^\/enterprise\/events\/([^/]+)\/speaker-queue$/);
  if (speakerQueueMatch && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const queue = await getSpeakerQueue(env, {
      projectId: auth.projectId, eventId: decodeURIComponent(speakerQueueMatch[1]),
    });
    return json({ queue, count: queue.length });
  }

  const acceptMatch = url.pathname.match(/^\/enterprise\/speakers\/([^/]+)\/accept$/);
  if (acceptMatch && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const ok = await acceptSpeakerInvite(env, { projectId: auth.projectId, speakerId: decodeURIComponent(acceptMatch[1]) });
    return json({ ok });
  }

  const joinMatch = url.pathname.match(/^\/enterprise\/speakers\/([^/]+)\/join$/);
  if (joinMatch && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const ok = await joinAsSpeaker(env, { projectId: auth.projectId, speakerId: decodeURIComponent(joinMatch[1]) });
    return json({ ok });
  }

  const leaveMatch = url.pathname.match(/^\/enterprise\/speakers\/([^/]+)\/leave$/);
  if (leaveMatch && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const ok = await leaveSpeaker(env, { projectId: auth.projectId, speakerId: decodeURIComponent(leaveMatch[1]) });
    return json({ ok });
  }

  /* Reactions */
  const reactionsMatch = url.pathname.match(/^\/enterprise\/events\/([^/]+)\/reactions$/);
  if (reactionsMatch && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.emoji) return json({ error: "emoji required" }, { status: 400 });
    const reaction = await addReaction(env, {
      projectId: auth.projectId, eventId: decodeURIComponent(reactionsMatch[1]),
      userId: auth.userId, emoji: body.emoji,
    });
    return json(reaction, { status: 201 });
  }

  if (reactionsMatch && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const params = Object.fromEntries(url.searchParams);
    const summary = await getReactionSummary(env, {
      projectId: auth.projectId, eventId: decodeURIComponent(reactionsMatch[1]),
      windowSeconds: params.window ? parseInt(params.window) : 30,
    });
    return json({ reactions: summary });
  }

  /* Stats */
  const statsMatch = url.pathname.match(/^\/enterprise\/events\/([^/]+)\/stats$/);
  if (statsMatch && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const stats = await getEventStats(env, {
      projectId: auth.projectId, eventId: decodeURIComponent(statsMatch[1]),
    });
    return json(stats);
  }

  return null;
}
