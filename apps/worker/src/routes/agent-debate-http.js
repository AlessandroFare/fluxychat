import { pickRouteDeps } from "./route-http-deps.js";
import {
  createDebateRole,
  deleteDebateRole,
  listDebateRoles,
  listDebateSessions,
  runDebateSession,
  seedDefaultDebateRoles,
} from "../lib/agent-debate.js";

export async function dispatchAgentDebateRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/admin/agent-debate")) return null;

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

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  if (!hasAnyRole(auth.roles, ["owner", "admin", "moderator"])) {
    return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
  }

  try {
    if (request.method === "GET" && path === "/admin/agent-debate/roles") {
      const roles = await listDebateRoles(env, { projectId: auth.projectId });
      return json({ ok: true, roles }, { headers: corsHeaders });
    }

    if (request.method === "POST" && path === "/admin/agent-debate/roles") {
      const body = await request.json().catch(() => ({}));
      const result = await createDebateRole(env, {
        projectId: auth.projectId,
        roleName: body.roleName,
        systemPrompt: body.systemPrompt,
        triggerPattern: body.triggerPattern,
        maxRounds: body.maxRounds,
        sortOrder: body.sortOrder,
      });
      if (!result.ok) return json(result, { status: 400, headers: corsHeaders });
      return json(result, { status: 201, headers: corsHeaders });
    }

    if (request.method === "POST" && path === "/admin/agent-debate/roles/seed") {
      const result = await seedDefaultDebateRoles(env, { projectId: auth.projectId });
      return json(result, { headers: corsHeaders });
    }

    const roleMatch = path.match(/^\/admin\/agent-debate\/roles\/([^/]+)$/);
    if (roleMatch && request.method === "DELETE") {
      const result = await deleteDebateRole(env, {
        projectId: auth.projectId,
        roleId: decodeURIComponent(roleMatch[1]),
      });
      return json(result, { headers: corsHeaders });
    }

    if (request.method === "GET" && path === "/admin/agent-debate/sessions") {
      const roomId = url.searchParams.get("roomId");
      if (!roomId) {
        return json({ error: "roomId required" }, { status: 400, headers: corsHeaders });
      }
      const sessions = await listDebateSessions(env, {
        projectId: auth.projectId,
        roomId,
        limit: url.searchParams.get("limit"),
      });
      return json({ ok: true, sessions }, { headers: corsHeaders });
    }

    if (request.method === "POST" && path === "/admin/agent-debate/run") {
      const body = await request.json().catch(() => ({}));
      const roomId = typeof body.roomId === "string" ? body.roomId.trim() : "";
      const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
      if (!roomId || !prompt) {
        return json({ error: "roomId and prompt required" }, { status: 400, headers: corsHeaders });
      }
      const result = await runDebateSession(env, {
        projectId: auth.projectId,
        roomId,
        prompt,
        roleIds: body.roleIds,
        maxRounds: body.maxRounds,
      });
      if (!result.ok) {
        const status = result.reason === "ai_not_configured" ? 503 : 400;
        return json(result, { status, headers: corsHeaders });
      }
      return json(result, { headers: corsHeaders });
    }

    return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
  } catch (err) {
    logError("agent_debate.route_failed", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
