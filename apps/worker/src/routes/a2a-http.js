import { pickRouteDeps } from "./route-http-deps.js";
import {
  buildAgentCardPublic,
  createA2ATask,
  delegateA2ATaskToRemote,
  fetchExternalAgentCard,
  getA2AAgentCard,
  getA2ATask,
  listA2AAgentCards,
  listA2ATasks,
  pingA2AAgentHealth,
  receiveA2AEnvelopes,
  sendA2AEnvelope,
  updateA2ATaskStatus,
  upsertA2AAgentCard,
  validateExternalHttpsUrl,
} from "../lib/a2a-worker.js";

export async function dispatchA2ARoutes(request, url, h) {
  const {
    env,
    json,
    corsHeaders,
    verifyJwtAndGetContext,
    hasAnyRole,
    logError,
    requestLogCtx,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "verifyJwtAndGetContext",
    "hasAnyRole",
    "logError",
    "requestLogCtx",
  ]);

  const path = url.pathname;
  if (!path.startsWith("/a2a") && !path.startsWith("/admin/a2a")) return null;

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  try {
    if (request.method === "GET" && path === "/a2a/agent-cards") {
      const cards = await listA2AAgentCards(env, { projectId: auth.projectId });
      return json({ ok: true, cards }, { headers: corsHeaders });
    }

    const publicCardMatch = path.match(/^\/a2a\/agent-cards\/([^/]+)\/public$/);
    if (publicCardMatch && request.method === "GET") {
      const agentId = decodeURIComponent(publicCardMatch[1]);
      const card = await getA2AAgentCard(env, { projectId: auth.projectId, agentId });
      if (!card) return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
      return json({ ok: true, agentCard: buildAgentCardPublic(card) }, { headers: corsHeaders });
    }

    if (request.method === "POST" && path === "/admin/a2a/agent-cards") {
      if (!hasAnyRole(auth.roles, ["owner", "admin", "moderator"])) {
        return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
      }
      const body = await request.json().catch(() => ({}));
      const result = await upsertA2AAgentCard(env, {
        projectId: auth.projectId,
        agentId: body.agentId,
        name: body.name,
        description: body.description,
        capabilities: body.capabilities,
        endpointUrl: body.endpointUrl,
        healthUrl: body.healthUrl,
        status: body.status,
      });
      if (!result.ok) return json(result, { status: 400, headers: corsHeaders });
      return json(result, { headers: corsHeaders });
    }

    const healthMatch = path.match(/^\/a2a\/agent-cards\/([^/]+)\/health$/);
    if (healthMatch && request.method === "GET") {
      const agentId = decodeURIComponent(healthMatch[1]);
      const card = await getA2AAgentCard(env, { projectId: auth.projectId, agentId });
      if (!card) return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
      const health = await pingA2AAgentHealth(env, {
        healthUrl: card.healthUrl,
        endpointUrl: card.endpointUrl,
      });
      return json({ ok: true, agentId, health }, { headers: corsHeaders });
    }

    if (request.method === "GET" && path === "/a2a/tasks") {
      const limit = Number(url.searchParams.get("limit") || 50);
      const tasks = await listA2ATasks(env, { projectId: auth.projectId, limit });
      return json({ ok: true, tasks }, { headers: corsHeaders });
    }

    const taskMatch = path.match(/^\/a2a\/tasks\/([^/]+)$/);
    if (taskMatch && request.method === "GET") {
      const task = await getA2ATask(env, { projectId: auth.projectId, taskId: taskMatch[1] });
      if (!task) return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
      return json({ ok: true, task }, { headers: corsHeaders });
    }

    if (request.method === "POST" && path === "/a2a/tasks") {
      const body = await request.json().catch(() => ({}));
      const result = await createA2ATask(env, {
        projectId: auth.projectId,
        title: body.title,
        taskInput: body.input,
        sourceAgentId: body.sourceAgentId ?? auth.userId,
        targetAgentId: body.targetAgentId,
      });
      if (!result.ok) return json(result, { status: 400, headers: corsHeaders });
      return json(result, { status: 201, headers: corsHeaders });
    }

    if (taskMatch && request.method === "PATCH") {
      const body = await request.json().catch(() => ({}));
      const result = await updateA2ATaskStatus(env, {
        projectId: auth.projectId,
        taskId: taskMatch[1],
        status: body.status,
        output: body.output,
        artifacts: body.artifacts,
      });
      if (!result.ok) return json(result, { status: result.error === "not_found" ? 404 : 400, headers: corsHeaders });
      return json(result, { headers: corsHeaders });
    }

    const delegateMatch = path.match(/^\/a2a\/tasks\/([^/]+)\/delegate$/);
    if (delegateMatch && request.method === "POST") {
      if (!hasAnyRole(auth.roles, ["owner", "admin", "moderator", "agent"])) {
        return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
      }
      const body = await request.json().catch(() => ({}));
      const result = await delegateA2ATaskToRemote(env, {
        projectId: auth.projectId,
        taskId: delegateMatch[1],
        targetAgentId: body.targetAgentId,
        bearerToken: body.bearerToken,
      });
      if (!result.ok) return json(result, { status: result.error === "task_not_found" ? 404 : 400, headers: corsHeaders });
      return json(result, { headers: corsHeaders });
    }

    if (request.method === "POST" && path === "/a2a/agent-cards/fetch") {
      const body = await request.json().catch(() => ({}));
      const validated = validateExternalHttpsUrl(body.cardUrl);
      if (!validated.ok) return json(validated, { status: 400, headers: corsHeaders });
      const result = await fetchExternalAgentCard(validated.url, {
        bearerToken: body.bearerToken || env.A2A_OUTBOUND_BEARER,
      });
      if (!result.ok) return json(result, { status: 502, headers: corsHeaders });
      return json(result, { headers: corsHeaders });
    }

    if (request.method === "POST" && path === "/a2a/envelopes") {
      const body = await request.json().catch(() => ({}));
      const result = await sendA2AEnvelope(env, {
        projectId: auth.projectId,
        sourceAgentId: body.sourceAgentId ?? auth.userId,
        targetAgentId: body.targetAgentId,
        taskId: body.taskId,
        status: body.status,
        extensions: body.extensions,
      });
      if (!result.ok) return json(result, { status: 400, headers: corsHeaders });
      return json(result, { status: 201, headers: corsHeaders });
    }

    if (request.method === "GET" && path === "/a2a/envelopes/receive") {
      const agentId = url.searchParams.get("agentId")?.trim();
      if (!agentId) return json({ error: "agentId_required" }, { status: 400, headers: corsHeaders });
      const result = await receiveA2AEnvelopes(env, {
        projectId: auth.projectId,
        agentId,
        markDelivered: url.searchParams.get("peek") !== "true",
      });
      return json(result, { headers: corsHeaders });
    }

    return null;
  } catch (err) {
    logError("a2a.unhandled", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
