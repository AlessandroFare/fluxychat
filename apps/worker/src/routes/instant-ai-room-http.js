/**
 * P15-H: Instant AI Room HTTP Routes.
 *
 * POST /enterprise/ai-rooms            — create instant AI room
 * GET  /enterprise/ai-rooms            — list AI rooms
 * GET  /enterprise/ai-rooms/:roomId    — get AI room config
 * PATCH /enterprise/ai-rooms/:roomId   — update AI room
 * DELETE /enterprise/ai-rooms/:roomId  — delete AI room
 * GET  /enterprise/ai-rooms/:roomId/agent — get agent config for embedding
 */
import { pickRouteDeps } from "./route-http-deps.js";
import {
  createInstantAIRoom,
  getInstantAIRoom,
  listInstantAIRooms,
  updateInstantAIRoom,
  deleteInstantAIRoom,
  getAgentConfig,
} from "../lib/instant-ai-room.js";

export async function dispatchAIRoomRoutes(request, url, h) {
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

  if (url.pathname === "/enterprise/ai-rooms" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    const room = await createInstantAIRoom(env, {
      projectId: auth.projectId, agentType: body?.agentType, agentName: body?.agentName,
      agentAvatarUrl: body?.agentAvatarUrl, agentSystemPrompt: body?.agentSystemPrompt,
      agentModel: body?.agentModel, welcomeMessage: body?.welcomeMessage,
      responseStyle: body?.responseStyle, allowedTopics: body?.allowedTopics,
      escalationThreshold: body?.escalationThreshold, autoResolveMinutes: body?.autoResolveMinutes,
      embedEnabled: body?.embedEnabled, embedPosition: body?.embedPosition,
      embedColor: body?.embedColor, embedTitle: body?.embedTitle, roomId: body?.roomId,
    });
    return json(room, { status: 201 });
  }

  if (url.pathname === "/enterprise/ai-rooms" && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const rooms = await listInstantAIRooms(env, { projectId: auth.projectId });
    return json({ rooms, count: rooms.length });
  }

  const roomMatch = url.pathname.match(/^\/enterprise\/ai-rooms\/([^/]+)$/);
  if (roomMatch && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const roomId = decodeURIComponent(roomMatch[1]);
    const room = await getInstantAIRoom(env, { projectId: auth.projectId, roomId });
    if (!room) return json({ error: "not_found" }, { status: 404 });
    return json(room);
  }

  if (roomMatch && request.method === "PATCH") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const roomId = decodeURIComponent(roomMatch[1]);
    const body = await request.json().catch(() => null);
    const room = await updateInstantAIRoom(env, { projectId: auth.projectId, roomId, updates: body });
    if (!room) return json({ error: "not_found" }, { status: 404 });
    return json(room);
  }

  if (roomMatch && request.method === "DELETE") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const roomId = decodeURIComponent(roomMatch[1]);
    const deleted = await deleteInstantAIRoom(env, { projectId: auth.projectId, roomId });
    return json({ deleted });
  }

  const agentMatch = url.pathname.match(/^\/enterprise\/ai-rooms\/([^/]+)\/agent$/);
  if (agentMatch && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const roomId = decodeURIComponent(agentMatch[1]);
    const agent = await getAgentConfig(env, { projectId: auth.projectId, roomId });
    if (!agent) return json({ error: "not_found" }, { status: 404 });
    return json(agent);
  }

  return null;
}
