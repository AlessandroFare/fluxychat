/**
 * P20-D: Community Moderation + Reputation HTTP Routes.
 *
 * Reputation: GET /community/reputation/:userId, POST /community/reputation
 * Leaderboard: GET /community/leaderboard, GET /community/leaderboard/contest
 * Spam:       POST /community/spam-rules, GET /community/spam-rules, POST /community/spam-evaluate
 * Warnings:   POST /community/warnings
 * Events:     GET /community/reputation/events
 * Stats:      GET /community/reputation/stats
 */
import { pickRouteDeps } from "./route-http-deps.js";
import {
  getReputation, upsertReputation, addWarning,
  getLeaderboard, getReputationEvents,
  createSpamRule, listSpamRules, evaluateSpam,
  getContestLeaderboard, getReputationStats,
} from "../lib/community-reputation.js";

export async function dispatchCommunityRoutes(request, url, h) {
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

  /* Reputation */
  const repMatch = url.pathname.match(/^\/community\/reputation\/([^/]+)$/);
  if (repMatch && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const rep = await getReputation(env, { projectId: auth.projectId, userId: decodeURIComponent(repMatch[1]) });
    return json(rep || { score: 0, level: 1, levelName: "newbie", trusted: false });
  }

  if (url.pathname === "/community/reputation" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.userId || !body?.eventType) return json({ error: "userId and eventType required" }, { status: 400 });
    const result = await upsertReputation(env, {
      projectId: auth.projectId, userId: body.userId,
      points: body.points || 1, eventType: body.eventType, description: body.description,
    });
    return json(result, { status: 201 });
  }

  /* Leaderboard */
  if (url.pathname === "/community/leaderboard" && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const params = Object.fromEntries(url.searchParams);
    const lb = await getLeaderboard(env, {
      projectId: auth.projectId, limit: params.limit ? parseInt(params.limit) : 20,
    });
    return json({ leaderboard: lb, count: lb.length });
  }

  if (url.pathname === "/community/leaderboard/contest" && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const params = Object.fromEntries(url.searchParams);
    const lb = await getContestLeaderboard(env, {
      projectId: auth.projectId, timeframe: params.timeframe || "week",
      limit: params.limit ? parseInt(params.limit) : 10,
    });
    return json({ leaderboard: lb, timeframe: params.timeframe || "week" });
  }

  /* Spam Rules */
  if (url.pathname === "/community/spam-rules" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.ruleName || !body?.ruleType) return json({ error: "ruleName and ruleType required" }, { status: 400 });
    const rule = await createSpamRule(env, {
      projectId: auth.projectId, ruleName: body.ruleName, ruleType: body.ruleType,
      config: body.config, action: body.action,
    });
    return json(rule, { status: 201 });
  }

  if (url.pathname === "/community/spam-rules" && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const rules = await listSpamRules(env, { projectId: auth.projectId });
    return json({ rules, count: rules.length });
  }

  if (url.pathname === "/community/spam-evaluate" && request.method === "POST") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.content) return json({ error: "content required" }, { status: 400 });
    const result = await evaluateSpam(env, {
      projectId: auth.projectId, content: body.content, userId: auth.userId,
    });
    return json(result);
  }

  /* Warnings */
  if (url.pathname === "/community/warnings" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.userId) return json({ error: "userId required" }, { status: 400 });
    const result = await addWarning(env, { projectId: auth.projectId, userId: body.userId });
    return json(result, { status: 201 });
  }

  /* Events */
  if (url.pathname === "/community/reputation/events" && request.method === "GET") {
    const auth = await anyAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const params = Object.fromEntries(url.searchParams);
    const events = await getReputationEvents(env, {
      projectId: auth.projectId, userId: params.userId,
      eventType: params.eventType, limit: params.limit ? parseInt(params.limit) : 50,
    });
    return json({ events, count: events.length });
  }

  /* Stats */
  if (url.pathname === "/community/reputation/stats" && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const stats = await getReputationStats(env, { projectId: auth.projectId });
    return json(stats);
  }

  return null;
}
