import { pickRouteDeps } from "./route-http-deps.js";
import { canAccessRoom } from "../lib/room-access.js";
import {
  getAutonomousTask,
  listAutonomousTasks,
  submitAutonomousTask,
  updateAutonomousTask,
} from "../lib/agent-task-bus.js";

export async function dispatchAgentTaskBusRoutes(request, url, h) {
  const path = url.pathname;

  if (path === "/agents/tasks" && request.method === "POST") {
    return dispatchSubmit(request, url, h);
  }
  if (path === "/agents/tasks" && request.method === "GET") {
    return dispatchList(request, url, h);
  }
  const taskMatch = path.match(/^\/agents\/tasks\/([^/]+)$/);
  if (taskMatch && request.method === "GET") {
    return dispatchGet(request, url, h, decodeURIComponent(taskMatch[1]));
  }
  if (taskMatch && request.method === "PATCH") {
    return dispatchUpdate(request, url, h, decodeURIComponent(taskMatch[1]));
  }
  return null;
}

async function authContext(request, env, h) {
  const { verifyJwtAndGetContext, logError, requestLogCtx } = pickRouteDeps(h, [
    "verifyJwtAndGetContext",
    "logError",
    "requestLogCtx",
  ]);
  return verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
}

async function dispatchSubmit(request, url, h) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const body = await request.json().catch(() => null);
  if (!body?.roomId) return json({ error: "room_id_required" }, { status: 400, headers: corsHeaders });

  const allowed = await canAccessRoom(env, auth, body.roomId);
  if (!allowed) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

  const result = await submitAutonomousTask(
    env,
    {
      roomId: body.roomId,
      fromAgentId: body.fromAgentId || auth.userId,
      toAgentId: body.toAgentId,
      taskInput: body.input,
      idempotencyKey: body.idempotencyKey,
      depth: body.depth,
      parentTaskId: body.parentTaskId,
      metadata: body.metadata,
      resumeAt: body.resumeAt,
    },
    auth,
  );
  if (!result.ok) return json({ error: result.error }, { status: 400, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchList(request, url, h) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const result = await listAutonomousTasks(env, {
    projectId: auth.projectId,
    roomId: url.searchParams.get("roomId") || undefined,
    status: url.searchParams.get("status") || undefined,
    toAgentId: url.searchParams.get("toAgentId") || undefined,
    limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
  });
  return json(result, { headers: corsHeaders });
}

async function dispatchGet(request, url, h, taskId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const result = await getAutonomousTask(env, { projectId: auth.projectId, taskId });
  if (!result.ok) return json({ error: result.error }, { status: 404, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}

async function dispatchUpdate(request, url, h, taskId) {
  const { env, json, corsHeaders } = pickRouteDeps(h, ["env", "json", "corsHeaders"]);
  const auth = await authContext(request, env, h);
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const body = await request.json().catch(() => null);
  if (!body?.status) return json({ error: "status_required" }, { status: 400, headers: corsHeaders });

  const result = await updateAutonomousTask(
    env,
    {
      taskId,
      status: body.status,
      artifact: body.artifact,
      error: body.error,
      resumeAt: body.resumeAt,
    },
    auth,
  );
  if (!result.ok) return json({ error: result.error }, { status: 404, headers: corsHeaders });
  return json(result, { headers: corsHeaders });
}
