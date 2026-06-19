import { json } from "../lib/http-json.js";
import { requireApiProjectAdmin } from "../lib/api-route-project-auth.js";
import {
  createCompanion, updateCompanion, getCompanion, listCompanions, deleteCompanion,
  assignToRoom, unassignFromRoom, listCompanionRooms, listCompanionsInRoom,
  recordInteraction, listInteractions, addMemory, searchMemory, getCompanionStats,
} from "../lib/ai-companions.js";

export async function dispatchCompanionRoutes(request, url, h) {
  const path = url.pathname;
  // Audit CRITICAL #3: this dispatcher previously trusted h.projectId
  // (derived from an untrusted header/default) with NO authentication, so all
  // companion CRUD/memory was world-readable/writable and cross-tenant. Gate
  // every /admin/companions route behind an owner/admin JWT and bind the
  // tenant from the verified token.
  if (!path.startsWith("/admin/companions")) return null;
  const gate = await requireApiProjectAdmin(request, h);
  if (gate.response) return gate.response;
  const projectId = gate.projectId;

  if (request.method === "POST" && path === "/admin/companions") {
    const body = await request.json();
    const result = await createCompanion(h.env, {
      projectId, name: body.name, avatarUrl: body.avatarUrl,
      description: body.description, systemPrompt: body.systemPrompt,
      personality: body.personality, skills: body.skills,
      triggerMode: body.triggerMode, triggerKeywords: body.triggerKeywords,
      temperature: body.temperature, maxTokens: body.maxTokens, model: body.model,
    });
    return json(result, h, 201);
  }

  if (request.method === "GET" && path === "/admin/companions") {
    const status = url.searchParams.get("status");
    const companions = await listCompanions(h.env, { projectId, status });
    return json({ companions }, h);
  }

  if (request.method === "GET" && path.match(/^\/admin\/companions\/[^/]+$/)) {
    const companionId = path.split("/").pop();
    const companion = await getCompanion(h.env, { companionId, projectId });
    if (!companion) return json({ error: "not_found" }, h, 404);
    const rooms = await listCompanionRooms(h.env, { companionId, projectId });
    return json({ companion, rooms }, h);
  }

  if (request.method === "PATCH" && path.match(/^\/admin\/companions\/[^/]+$/)) {
    const companionId = path.split("/").pop();
    const body = await request.json();
    const result = await updateCompanion(h.env, { companionId, ...body, projectId });
    return json(result, h);
  }

  if (request.method === "DELETE" && path.match(/^\/admin\/companions\/[^/]+$/)) {
    const companionId = path.split("/").pop();
    const result = await deleteCompanion(h.env, { companionId, projectId });
    return json(result, h);
  }

  if (request.method === "POST" && path === "/admin/companions/assign") {
    const body = await request.json();
    const result = await assignToRoom(h.env, {
      companionId: body.companionId, projectId, roomId: body.roomId,
      joinMessage: body.joinMessage, leaveMessage: body.leaveMessage,
      customPromptOverride: body.customPromptOverride,
    });
    if (result.error) return json(result, h, 400);
    return json(result, h, 201);
  }

  if (request.method === "POST" && path === "/admin/companions/unassign") {
    const body = await request.json();
    const result = await unassignFromRoom(h.env, { companionId: body.companionId, roomId: body.roomId });
    return json(result, h);
  }

  if (request.method === "GET" && path === "/admin/companions/room") {
    const roomId = url.searchParams.get("roomId");
    const companions = await listCompanionsInRoom(h.env, { roomId });
    return json({ companions }, h);
  }

  if (request.method === "POST" && path === "/admin/companions/interact") {
    const body = await request.json();
    const result = await recordInteraction(h.env, {
      companionId: body.companionId, projectId,
      roomId: body.roomId, userId: body.userId, inputText: body.inputText,
      outputText: body.outputText, tokensUsed: body.tokensUsed,
      latencyMs: body.latencyMs, triggeredBy: body.triggeredBy,
    });
    return json(result, h, 201);
  }

  if (request.method === "GET" && path === "/admin/companions/interactions") {
    const companionId = url.searchParams.get("companionId");
    const roomId = url.searchParams.get("roomId");
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "25", 10) || 25, 1), 100);
    const interactions = await listInteractions(h.env, { companionId, projectId, roomId, limit });
    return json({ interactions }, h);
  }

  if (request.method === "POST" && path === "/admin/companions/memory") {
    const body = await request.json();
    const result = await addMemory(h.env, {
      companionId: body.companionId, projectId,
      roomId: body.roomId, memoryType: body.memoryType,
      content: body.content, source: body.source,
      importance: body.importance, expiresAt: body.expiresAt,
    });
    return json(result, h, 201);
  }

  if (request.method === "GET" && path === "/admin/companions/memory/search") {
    const companionId = url.searchParams.get("companionId");
    const roomId = url.searchParams.get("roomId");
    const query = url.searchParams.get("q");
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "10", 10) || 10, 1), 100);
    const memories = await searchMemory(h.env, { companionId, projectId, roomId, query, limit });
    return json({ memories }, h);
  }

  if (request.method === "GET" && path === "/admin/companions/stats") {
    const stats = await getCompanionStats(h.env, { projectId });
    return json({ stats }, h);
  }

  return null;
}
