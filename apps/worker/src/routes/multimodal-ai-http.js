/**
 * P15-I: Multimodal AI HTTP Routes.
 *
 * POST /enterprise/multimodal/analyze       — analyze media
 * GET  /enterprise/multimodal/:messageId    — get analysis
 * GET  /enterprise/multimodal/room/:roomId  — get room analyses
 * POST /enterprise/multimodal/moderate/:messageId — moderate media
 * GET  /enterprise/multimodal/stats         — media stats
 */
import { pickRouteDeps } from "./route-http-deps.js";
import {
  analyzeMedia,
  getMediaAnalysis,
  getRoomMediaAnalyses,
  moderateMediaContent,
  getMediaStats,
} from "../lib/multimodal-ai.js";

export async function dispatchMultimodalRoutes(request, url, h) {
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

  if (url.pathname === "/enterprise/multimodal/analyze" && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const body = await request.json().catch(() => null);
    if (!body?.mediaType || (!body?.mediaUrl && !body?.mediaBase64)) {
      return json({ error: "mediaType and mediaUrl or mediaBase64 required" }, { status: 400 });
    }
    const result = await analyzeMedia(env, {
      projectId: auth.projectId, messageId: body.messageId || crypto.randomUUID(),
      roomId: body.roomId || "default", mediaType: body.mediaType,
      mediaUrl: body.mediaUrl, mediaBase64: body.mediaBase64,
      customPrompt: body.customPrompt, model: body.model, userId: auth.userId,
    });
    return json(result, { status: 201 });
  }

  const analysisMatch = url.pathname.match(/^\/enterprise\/multimodal\/([^/]+)$/);
  if (analysisMatch && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const messageId = decodeURIComponent(analysisMatch[1]);
    const analysis = await getMediaAnalysis(env, { projectId: auth.projectId, messageId });
    if (!analysis) return json({ error: "not_found" }, { status: 404 });
    return json(analysis);
  }

  const roomMatch = url.pathname.match(/^\/enterprise\/multimodal\/room\/([^/]+)$/);
  if (roomMatch && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const roomId = decodeURIComponent(roomMatch[1]);
    const params = Object.fromEntries(url.searchParams);
    const analyses = await getRoomMediaAnalyses(env, {
      projectId: auth.projectId, roomId,
      limit: params.limit ? parseInt(params.limit) : 20,
    });
    return json({ analyses, count: analyses.length });
  }

  const moderateMatch = url.pathname.match(/^\/enterprise\/multimodal\/moderate\/([^/]+)$/);
  if (moderateMatch && request.method === "POST") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const messageId = decodeURIComponent(moderateMatch[1]);
    const result = await moderateMediaContent(env, { projectId: auth.projectId, messageId });
    return json(result);
  }

  if (url.pathname === "/enterprise/multimodal/stats" && request.method === "GET") {
    const auth = await adminAuth();
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    const stats = await getMediaStats(env, { projectId: auth.projectId });
    return json(stats);
  }

  return null;
}

