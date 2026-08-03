import { pickRouteDeps } from "./route-http-deps.js";
import { resolveAdminContext } from "../lib/admin-route-context.js";
import {
  listVoiceAiProviders,
  createVoiceAiSession,
  recordVoiceAiMetrics,
  getVoiceAiMetrics,
  getVoiceAiStats,
} from "../lib/voice-ai-pipeline.js";

export async function dispatchVoiceAiRoutes(request, url, h) {
  const path = url.pathname;

  if (request.method === "GET" && path === "/voice-ai/providers") {
    const { json: respond } = pickRouteDeps(h, ["json"]);
    return respond({ providers: listVoiceAiProviders() }, h);
  }

  if (!path.startsWith("/admin/voice-ai")) return null;

  const ctx = await resolveAdminContext(request, h);
  if (ctx.response) return ctx.response;
  const { env, json: respond, projectId, userId } = ctx;

  if (request.method === "GET" && path === "/admin/voice-ai/providers") {
    return respond({ providers: listVoiceAiProviders() }, h);
  }

  if (request.method === "POST" && path === "/admin/voice-ai/sessions") {
    const body = await request.json().catch(() => null);
    const result = await createVoiceAiSession(env, {
      projectId,
      providerId: body?.providerId,
      roomId: body?.roomId,
      userId: body?.userId || userId,
      settings: body?.settings,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "POST" && path === "/admin/voice-ai/metrics") {
    const body = await request.json().catch(() => null);
    if (!body?.sessionId) return respond({ error: "sessionId required" }, h, 400);
    const result = await recordVoiceAiMetrics(env, {
      projectId,
      sessionId: body.sessionId,
      stages: body.stages,
      totalLatencyMs: body.totalLatencyMs,
      providerId: body.providerId,
      pipelineMode: body.pipelineMode,
    });
    return respond(result, h);
  }

  if (request.method === "GET" && path === "/admin/voice-ai/metrics") {
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const entries = await getVoiceAiMetrics(env, { projectId, limit });
    return respond({ entries, count: entries.length }, h);
  }

  if (request.method === "GET" && path === "/admin/voice-ai/stats") {
    const stats = await getVoiceAiStats(env, { projectId });
    return respond({ stats }, h);
  }

  return null;
}
