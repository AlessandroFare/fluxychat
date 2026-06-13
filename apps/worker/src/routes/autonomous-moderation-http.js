import { pickRouteDeps } from "./route-http-deps.js";
import { resolveMemberContext } from "../lib/admin-route-context.js";
import {
  upsertAutoRule,
  listAutoRules,
  evaluateAndAct,
  getAutoActionHistory,
  appealAutoAction,
  getAutoModStats,
} from "../lib/autonomous-moderation.js";

export async function dispatchAutonomousModRoutes(request, url, h) {
  const { json, corsHeaders } = pickRouteDeps(h, ["json", "corsHeaders"]);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const ctx = await resolveMemberContext(request, h);
  if (ctx.response) return ctx.response;
  const { env, projectId, userId } = ctx;
  const path = url.pathname;

  if (path === "/auto-mod/rules" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const result = await upsertAutoRule(env, {
      projectId,
      name: body.name,
      description: body.description,
      severityMin: body.severityMin,
      confidenceMin: body.confidenceMin,
      action: body.action,
      muteDurationMinutes: body.muteDurationMinutes,
      timeoutDurationMinutes: body.timeoutDurationMinutes,
      cooldownMinutes: body.cooldownMinutes,
      maxActionsPerHour: body.maxActionsPerHour,
      notifyAdmins: body.notifyAdmins,
      notifyUser: body.notifyUser,
      appealEnabled: body.appealEnabled,
    });
    return json(result, { status: result.ok ? 201 : 400 });
  }

  const ruleMatch = path.match(/^\/auto-mod\/rules\/([^/]+)$/);
  if (ruleMatch && request.method === "PATCH") {
    const body = await request.json().catch(() => ({}));
    const result = await upsertAutoRule(env, {
      projectId,
      id: ruleMatch[1],
      name: body.name,
      description: body.description,
      severityMin: body.severityMin,
      confidenceMin: body.confidenceMin,
      action: body.action,
      muteDurationMinutes: body.muteDurationMinutes,
      timeoutDurationMinutes: body.timeoutDurationMinutes,
      cooldownMinutes: body.cooldownMinutes,
      maxActionsPerHour: body.maxActionsPerHour,
      notifyAdmins: body.notifyAdmins,
      notifyUser: body.notifyUser,
      appealEnabled: body.appealEnabled,
    });
    return json(result, { status: result.ok ? 200 : 400 });
  }

  if (path === "/auto-mod/rules" && request.method === "GET") {
    const result = await listAutoRules(env, { projectId });
    return json(result);
  }

  if (path === "/auto-mod/evaluate" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const result = await evaluateAndAct(env, {
      projectId,
      roomId: body.roomId,
      userId: body.userId || userId,
      messageId: body.messageId,
      severity: body.severity,
      confidence: body.confidence,
      reason: body.reason,
      aiRawResponse: body.aiRawResponse,
    });
    return json(result);
  }

  if (path === "/auto-mod/history" && request.method === "GET") {
    const urlObj = new URL(request.url);
    const result = await getAutoActionHistory(env, {
      projectId,
      userId: urlObj.searchParams.get("userId"),
      roomId: urlObj.searchParams.get("roomId"),
      limit: Number(urlObj.searchParams.get("limit")) || 50,
    });
    return json(result);
  }

  if (path === "/auto-mod/appeal" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const result = await appealAutoAction(env, {
      projectId,
      actionId: body.actionId,
      userId: body.userId || userId,
    });
    return json(result, { status: result.ok ? 200 : 400 });
  }

  if (path === "/auto-mod/stats" && request.method === "GET") {
    const result = await getAutoModStats(env, { projectId });
    return json(result);
  }

  return null;
}
