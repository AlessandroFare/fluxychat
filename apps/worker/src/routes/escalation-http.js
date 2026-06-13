import { pickRouteDeps } from "./route-http-deps.js";
import { canAccessAgentQueue } from "../lib/agent-queue.js";
import {
  canManageEscalationRules,
  listEscalationRules,
  getEscalationRule,
  createEscalationRule,
  updateEscalationRule,
  deleteEscalationRule,
  listEscalationEvents,
  getEscalationStats,
  runEscalationScan,
} from "../lib/escalation-rules.js";

export async function dispatchEscalationRoutes(request, url, h) {
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

  /* ── GET /escalation/rules ── */
  if (url.pathname === "/escalation/rules" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!canAccessAgentQueue(auth.roles)) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }

    const rules = await listEscalationRules(env, { projectId: auth.projectId });
    return json({ rules }, { headers: corsHeaders });
  }

  /* ── POST /escalation/rules ── */
  if (url.pathname === "/escalation/rules" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!canManageEscalationRules(auth.roles)) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }

    const body = await request.json().catch(() => null);
    const result = await createEscalationRule(env, {
      projectId: auth.projectId,
      name: body?.name,
      description: body?.description,
      priority: body?.priority,
      triggerAfterMinutes: body?.triggerAfterMinutes,
      action: body?.action,
      targetUserId: body?.targetUserId,
      targetRole: body?.targetRole,
      notificationMessage: body?.notificationMessage,
      roomAnnounce: body?.roomAnnounce,
      repeatIntervalMinutes: body?.repeatIntervalMinutes,
      maxRepeats: body?.maxRepeats,
    });

    if (!result.ok) {
      return json({ error: result.error }, { status: 400, headers: corsHeaders });
    }
    return json(result.rule, { status: 201, headers: corsHeaders });
  }

  /* ── GET /escalation/rules/:id ── */
  const ruleGetMatch = url.pathname.match(/^\/escalation\/rules\/([^/]+)$/);
  if (ruleGetMatch && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!canAccessAgentQueue(auth.roles)) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }

    const ruleId = decodeURIComponent(ruleGetMatch[1]);
    const rule = await getEscalationRule(env, { projectId: auth.projectId, ruleId });
    if (!rule) {
      return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
    }
    return json(rule, { headers: corsHeaders });
  }

  /* ── PATCH /escalation/rules/:id ── */
  const rulePatchMatch = url.pathname.match(/^\/escalation\/rules\/([^/]+)$/);
  if (rulePatchMatch && request.method === "PATCH") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!canManageEscalationRules(auth.roles)) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }

    const ruleId = decodeURIComponent(rulePatchMatch[1]);
    const body = await request.json().catch(() => null);
    const result = await updateEscalationRule(env, {
      projectId: auth.projectId,
      ruleId,
      name: body?.name,
      description: body?.description,
      priority: body?.priority,
      triggerAfterMinutes: body?.triggerAfterMinutes,
      action: body?.action,
      targetUserId: body?.targetUserId,
      targetRole: body?.targetRole,
      notificationMessage: body?.notificationMessage,
      roomAnnounce: body?.roomAnnounce,
      repeatIntervalMinutes: body?.repeatIntervalMinutes,
      maxRepeats: body?.maxRepeats,
      enabled: body?.enabled,
    });

    if (!result.ok) {
      const status = result.error === "not_found" ? 404 : 400;
      return json({ error: result.error }, { status, headers: corsHeaders });
    }
    return json(result.rule, { headers: corsHeaders });
  }

  /* ── DELETE /escalation/rules/:id ── */
  const ruleDeleteMatch = url.pathname.match(/^\/escalation\/rules\/([^/]+)$/);
  if (ruleDeleteMatch && request.method === "DELETE") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!canManageEscalationRules(auth.roles)) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }

    const ruleId = decodeURIComponent(ruleDeleteMatch[1]);
    const result = await deleteEscalationRule(env, { projectId: auth.projectId, ruleId });
    if (!result.ok) {
      return json({ error: result.error }, { status: 404, headers: corsHeaders });
    }
    return json({ ok: true }, { headers: corsHeaders });
  }

  /* ── GET /escalation/events ── */
  if (url.pathname === "/escalation/events" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!canAccessAgentQueue(auth.roles)) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }

    const taskId = url.searchParams.get("taskId");
    const events = await listEscalationEvents(env, {
      projectId: auth.projectId,
      taskId: taskId || undefined,
    });
    return json({ events }, { headers: corsHeaders });
  }

  /* ── GET /escalation/stats ── */
  if (url.pathname === "/escalation/stats" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!canAccessAgentQueue(auth.roles)) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }

    const stats = await getEscalationStats(env, { projectId: auth.projectId });
    return json(stats, { headers: corsHeaders });
  }

  /* ── POST /escalation/scan ── */
  if (url.pathname === "/escalation/scan" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!canManageEscalationRules(auth.roles)) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }

    const result = await runEscalationScan(env, { projectId: auth.projectId });
    return json(result, { headers: corsHeaders });
  }

  return null;
}
