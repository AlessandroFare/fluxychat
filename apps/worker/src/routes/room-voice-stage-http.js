import { pickRouteDeps } from "./route-http-deps.js";
import {
  getVoiceStageConfig,
  upsertVoiceStageConfig,
} from "../lib/room-voice-stage.js";

export async function dispatchRoomVoiceStageRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/rooms/") || !path.includes("/stage")) return null;

  const {
    env,
    json,
    corsHeaders,
    verifyJwtAndGetContext,
    logError,
    requestLogCtx,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "verifyJwtAndGetContext",
    "logError",
    "requestLogCtx",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const match = path.match(/^\/rooms\/([^/]+)\/stage$/);
  if (!match) return null;
  const roomId = decodeURIComponent(match[1]);

  try {
    if (request.method === "GET") {
      const config = await getVoiceStageConfig(env, { projectId: auth.projectId, roomId });
      return json({ ok: true, config }, { headers: corsHeaders });
    }

    if (request.method === "POST" || request.method === "PUT") {
      const body = await request.json().catch(() => ({}));
      const result = await upsertVoiceStageConfig(env, {
        projectId: auth.projectId,
        roomId,
        enabled: body.enabled !== false,
        maxSpeakers: body.maxSpeakers,
      });
      if (!result.ok) return json(result, { status: 400, headers: corsHeaders });
      return json(result, { headers: corsHeaders });
    }

    return json({ error: "method_not_allowed" }, { status: 405, headers: corsHeaders });
  } catch (err) {
    logError("voice_stage.route_failed", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
