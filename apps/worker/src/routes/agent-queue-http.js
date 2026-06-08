import { pickRouteDeps } from "./route-http-deps.js";
import { canAccessRoom } from "../lib/room-access.js";
import {
  canAccessAgentQueue,
  createAgentTask,
  listAgentTasks,
  claimAgentTask,
  releaseAgentTask,
  resolveAgentTask,
  resolveAgentQueueSlaMinutes,
} from "../lib/agent-queue.js";
import {
  getAgentDispositionStats,
  listAgentDispositions,
} from "../lib/agent-dispositions.js";

export async function dispatchAgentQueueRoutes(request, url, h) {
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

  if (url.pathname === "/agent-queue/dispositions" && request.method === "GET") {
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
    return json({ dispositions: listAgentDispositions() }, { headers: corsHeaders });
  }

  if (url.pathname === "/admin/agent-queue/stats" && request.method === "GET") {
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
    const stats = await getAgentDispositionStats(env, auth.projectId);
    return json(stats, { headers: corsHeaders });
  }

  if (url.pathname === "/agent-queue" && request.method === "GET") {
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

    const statusParam = url.searchParams.get("status");
    const assigneeParam = url.searchParams.get("assignee");
    const limit = url.searchParams.get("limit");

    const summary = await listAgentTasks(env, {
      projectId: auth.projectId,
      userId: auth.userId,
      status: statusParam || undefined,
      assignee: assigneeParam === "me" ? "me" : "all",
      limit: limit ? Number(limit) : undefined,
    });
    return json(
      {
        ...summary,
        slaMinutes: resolveAgentQueueSlaMinutes(env),
      },
      { headers: corsHeaders },
    );
  }

  if (url.pathname === "/agent-queue" && request.method === "POST") {
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

    const body = await request.json().catch(() => null);
    const roomId = typeof body?.roomId === "string" ? body.roomId.trim() : "";
    if (!isValidId(roomId)) {
      return json({ error: "roomId required" }, { status: 400, headers: corsHeaders });
    }
    const allowed = await canAccessRoom(env, auth, roomId);
    if (!allowed) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }

    const result = await createAgentTask(env, {
      projectId: auth.projectId,
      roomId,
      createdByUserId: auth.userId,
      note: typeof body?.note === "string" ? body.note : null,
      priority: body?.priority,
      slaMinutes: body?.slaMinutes,
      triggerSource: "manual",
    });
    if (!result.ok) {
      const status = result.error === "room_already_queued" ? 409 : 400;
      return json({ error: result.error }, { status, headers: corsHeaders });
    }
    return json(result.task, { status: 201, headers: corsHeaders });
  }

  const claimMatch = url.pathname.match(/^\/agent-queue\/([^/]+)\/claim$/);
  if (claimMatch && request.method === "POST") {
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

    const taskId = decodeURIComponent(claimMatch[1]);
    const result = await claimAgentTask(env, {
      projectId: auth.projectId,
      taskId,
      userId: auth.userId,
    });
    if (!result.ok) {
      const status =
        result.error === "not_found" ? 404 : result.error === "not_claimable" ? 409 : 400;
      return json({ error: result.error }, { status, headers: corsHeaders });
    }
    return json({ ok: true, ...result }, { headers: corsHeaders });
  }

  const releaseMatch = url.pathname.match(/^\/agent-queue\/([^/]+)\/release$/);
  if (releaseMatch && request.method === "POST") {
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

    const taskId = decodeURIComponent(releaseMatch[1]);
    const result = await releaseAgentTask(env, {
      projectId: auth.projectId,
      taskId,
      userId: auth.userId,
      roles: auth.roles,
    });
    if (!result.ok) {
      const status =
        result.error === "not_found"
          ? 404
          : result.error === "forbidden"
            ? 403
            : 409;
      return json({ error: result.error }, { status, headers: corsHeaders });
    }
    return json({ ok: true }, { headers: corsHeaders });
  }

  const taskMatch = url.pathname.match(/^\/agent-queue\/([^/]+)$/);
  if (taskMatch && request.method === "PATCH") {
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

    const taskId = decodeURIComponent(taskMatch[1]);
    const body = await request.json().catch(() => null);
    const status =
      body?.status === "resolved"
        ? "resolved"
        : body?.status === "cancelled"
          ? "cancelled"
          : null;
    if (!status) {
      return json({ error: "invalid_status" }, { status: 400, headers: corsHeaders });
    }

    const result = await resolveAgentTask(env, {
      projectId: auth.projectId,
      taskId,
      userId: auth.userId,
      roles: auth.roles,
      status,
      disposition: typeof body?.disposition === "string" ? body.disposition : null,
    });
    if (!result.ok) {
      const code =
        result.error === "not_found"
          ? 404
          : result.error === "forbidden"
            ? 403
            : result.error === "already_closed"
              ? 409
              : 400;
      return json({ error: result.error }, { status: code, headers: corsHeaders });
    }
    return json({ ok: true, ...result }, { headers: corsHeaders });
  }

  return null;
}
