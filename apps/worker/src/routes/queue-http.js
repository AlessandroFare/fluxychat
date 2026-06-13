import { pickRouteDeps } from "./route-http-deps.js";
import { canAccessRoom } from "../lib/room-access.js";
import { canAccessAgentQueue } from "../lib/agent-queue.js";
import {
  canManageQueueRules,
  listQueueRules,
  getQueueRule,
  createQueueRule,
  updateQueueRule,
  deleteQueueRule,
  listAgentCapacities,
  getAgentCapacity,
  upsertAgentCapacity,
  autoAssignTask,
  escalateBreachedTasks,
  getQueueStats,
  listAssignments,
  findActiveRule,
} from "../lib/queue-management.js";

export async function dispatchQueueRoutes(request, url, h) {
  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
    isValidId,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "logError",
    "isValidId",
  ]);

  /* ── GET /queue/rules ── */
  if (url.pathname === "/queue/rules" && request.method === "GET") {
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

    const rules = await listQueueRules(env, { projectId: auth.projectId });
    const activeRule = await findActiveRule(env, { projectId: auth.projectId });
    return json({ rules, activeRuleId: activeRule?.id ?? null }, { headers: corsHeaders });
  }

  /* ── POST /queue/rules ── */
  if (url.pathname === "/queue/rules" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!canManageQueueRules(auth.roles)) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }

    const body = await request.json().catch(() => null);
    const result = await createQueueRule(env, {
      projectId: auth.projectId,
      name: body?.name,
      description: body?.description,
      strategy: body?.strategy,
      priority: body?.priority,
      slaMinutes: body?.slaMinutes,
      escalationSlaMinutes: body?.escalationSlaMinutes,
      requiredCapabilities: body?.requiredCapabilities,
      fallbackStrategy: body?.fallbackStrategy,
      fallbackAgentUserId: body?.fallbackAgentUserId,
    });

    if (!result.ok) {
      return json({ error: result.error }, { status: 400, headers: corsHeaders });
    }
    return json(result.rule, { status: 201, headers: corsHeaders });
  }

  /* ── GET /queue/rules/:id ── */
  const ruleGetMatch = url.pathname.match(/^\/queue\/rules\/([^/]+)$/);
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
    const rule = await getQueueRule(env, { projectId: auth.projectId, ruleId });
    if (!rule) {
      return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
    }
    return json(rule, { headers: corsHeaders });
  }

  /* ── PATCH /queue/rules/:id ── */
  const rulePatchMatch = url.pathname.match(/^\/queue\/rules\/([^/]+)$/);
  if (rulePatchMatch && request.method === "PATCH") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!canManageQueueRules(auth.roles)) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }

    const ruleId = decodeURIComponent(rulePatchMatch[1]);
    const body = await request.json().catch(() => null);
    const result = await updateQueueRule(env, {
      projectId: auth.projectId,
      ruleId,
      name: body?.name,
      description: body?.description,
      strategy: body?.strategy,
      priority: body?.priority,
      slaMinutes: body?.slaMinutes,
      escalationSlaMinutes: body?.escalationSlaMinutes,
      requiredCapabilities: body?.requiredCapabilities,
      fallbackStrategy: body?.fallbackStrategy,
      fallbackAgentUserId: body?.fallbackAgentUserId,
      enabled: body?.enabled,
    });

    if (!result.ok) {
      const status = result.error === "not_found" ? 404 : 400;
      return json({ error: result.error }, { status, headers: corsHeaders });
    }
    return json(result.rule, { headers: corsHeaders });
  }

  /* ── DELETE /queue/rules/:id ── */
  const ruleDeleteMatch = url.pathname.match(/^\/queue\/rules\/([^/]+)$/);
  if (ruleDeleteMatch && request.method === "DELETE") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!canManageQueueRules(auth.roles)) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }

    const ruleId = decodeURIComponent(ruleDeleteMatch[1]);
    const result = await deleteQueueRule(env, { projectId: auth.projectId, ruleId });
    if (!result.ok) {
      return json({ error: result.error }, { status: 404, headers: corsHeaders });
    }
    return json({ ok: true }, { headers: corsHeaders });
  }

  /* ── GET /queue/agents ── */
  if (url.pathname === "/queue/agents" && request.method === "GET") {
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

    const agents = await listAgentCapacities(env, { projectId: auth.projectId });
    return json({ agents }, { headers: corsHeaders });
  }

  /* ── PUT /queue/agents/:userId ── */
  const agentPutMatch = url.pathname.match(/^\/queue\/agents\/([^/]+)$/);
  if (agentPutMatch && request.method === "PUT") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!canManageQueueRules(auth.roles)) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }

    const userId = decodeURIComponent(agentPutMatch[1]);
    const body = await request.json().catch(() => null);
    const result = await upsertAgentCapacity(env, {
      projectId: auth.projectId,
      userId,
      maxConcurrent: body?.maxConcurrent,
      capabilities: body?.capabilities,
      isAvailable: body?.isAvailable,
    });

    return json(result.capacity, { status: 201, headers: corsHeaders });
  }

  /* ── GET /queue/agents/:userId ── */
  const agentGetMatch = url.pathname.match(/^\/queue\/agents\/([^/]+)$/);
  if (agentGetMatch && request.method === "GET") {
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

    const userId = decodeURIComponent(agentGetMatch[1]);
    const capacity = await getAgentCapacity(env, { projectId: auth.projectId, userId });
    if (!capacity) {
      return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
    }
    return json(capacity, { headers: corsHeaders });
  }

  /* ── POST /queue/assign/:taskId ── */
  const assignMatch = url.pathname.match(/^\/queue\/assign\/([^/]+)$/);
  if (assignMatch && request.method === "POST") {
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

    const taskId = decodeURIComponent(assignMatch[1]);
    const body = await request.json().catch(() => null);
    const roomId = typeof body?.roomId === "string" ? body.roomId.trim() : "";

    if (!isValidId(roomId)) {
      return json({ error: "roomId required" }, { status: 400, headers: corsHeaders });
    }

    const result = await autoAssignTask(env, {
      projectId: auth.projectId,
      taskId,
      roomId,
    });

    if (!result.ok) {
      const status = result.reason === "manual_or_no_rule" ? 409 : 400;
      return json({ error: result.reason ?? result.error ?? "assignment_failed" }, { status, headers: corsHeaders });
    }
    return json(result, { headers: corsHeaders });
  }

  /* ── POST /queue/escalate ── */
  if (url.pathname === "/queue/escalate" && request.method === "POST") {
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

    const result = await escalateBreachedTasks(env, { projectId: auth.projectId });
    return json(result, { headers: corsHeaders });
  }

  /* ── GET /queue/assignments ── */
  if (url.pathname === "/queue/assignments" && request.method === "GET") {
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

    const roomId = url.searchParams.get("roomId");
    const assignments = await listAssignments(env, {
      projectId: auth.projectId,
      roomId: roomId || undefined,
    });
    return json({ assignments }, { headers: corsHeaders });
  }

  /* ── GET /queue/stats ── */
  if (url.pathname === "/queue/stats" && request.method === "GET") {
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

    const stats = await getQueueStats(env, { projectId: auth.projectId });
    return json(stats, { headers: corsHeaders });
  }

  return null;
}
