/**
 * P14-D: AI Image Generation HTTP Routes.
 *
 * POST /ai-images/generate           — generate image from prompt
 * GET  /ai-images/:id                — get generation by ID
 * GET  /ai-images/room/:roomId       — list room generations
 * GET  /ai-images/stats              — generation stats
 * DELETE /ai-images/:id              — delete generation
 */
import { pickRouteDeps } from "./route-http-deps.js";
import { validateLimit } from "../lib/validation.js";
import {
  generateImage,
  getImageGeneration,
  listRoomImageGenerations,
  getImageGenerationStats,
  deleteImageGeneration,
} from "../lib/ai-image-generation.js";

export async function dispatchAiImageRoutes(request, url, h) {
  const {
    env, json, corsHeaders, requestLogCtx,
    verifyJwtAndGetContext, logError, hasAnyRole,
  } = pickRouteDeps(h, ["env", "json", "corsHeaders", "requestLogCtx", "verifyJwtAndGetContext", "logError", "hasAnyRole"]);

  async function auth() {
    const a = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    return a;
  }

  // POST /ai-images/generate
  if (url.pathname === "/ai-images/generate" && request.method === "POST") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.prompt) return json({ error: "prompt required" }, { status: 400 });
    if (!body?.roomId) return json({ error: "roomId required" }, { status: 400 });

    const result = await generateImage(env, {
      projectId: a.projectId,
      roomId: body.roomId,
      userId: a.userId,
      prompt: body.prompt,
      size: body.size,
      quality: body.quality,
      style: body.style,
      model: body.model,
      messageId: body.messageId,
    });
    return json(result, { status: result.ok ? 201 : (result.status || 500) });
  }

  // GET /ai-images/stats
  if (url.pathname === "/ai-images/stats" && request.method === "GET") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!hasAnyRole(a, ["owner", "admin"])) return new Response("Forbidden", { status: 403, headers: corsHeaders });
    const stats = await getImageGenerationStats(env, { projectId: a.projectId });
    return json(stats);
  }

  // GET /ai-images/room/:roomId
  const roomMatch = url.pathname.match(/^\/ai-images\/room\/([^/]+)$/);
  if (roomMatch && request.method === "GET") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const roomId = decodeURIComponent(roomMatch[1]);
    const limitResult = validateLimit(url.searchParams.get("limit"), { defaultValue: 20, max: 1000 });
    if (limitResult.error) return json({ error: "bad_request", message: limitResult.error }, { status: 400 });
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);
    const items = await listRoomImageGenerations(env, { projectId: a.projectId, roomId, limit: limitResult.value, offset });
    return json({ items });
  }

  // GET /ai-images/:id
  const idMatch = url.pathname.match(/^\/ai-images\/([^/]+)$/);
  if (idMatch && request.method === "GET") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const id = decodeURIComponent(idMatch[1]);
    const item = await getImageGeneration(env, { projectId: a.projectId, id });
    if (!item) return json({ error: "not_found" }, { status: 404 });
    return json(item);
  }

  // DELETE /ai-images/:id
  if (idMatch && request.method === "DELETE") {
    const a = await auth();
    if (!a) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    if (!hasAnyRole(a, ["owner", "admin"])) return new Response("Forbidden", { status: 403, headers: corsHeaders });
    const id = decodeURIComponent(idMatch[1]);
    const result = await deleteImageGeneration(env, { projectId: a.projectId, id });
    if (!result.ok) return json({ error: result.error }, { status: result.error === "not_found" ? 404 : 500 });
    return json({ ok: true });
  }

  return null;
}

