import { pickRouteDeps } from "./route-http-deps.js";
import { canAccessRoom } from "../lib/room-access.js";
import {
  getVoiceStageConfig,
  upsertVoiceStageConfig,
  runRoomStageCommand,
} from "../lib/room-voice-stage.js";
import { generateToken } from "../lib/video-voice.js";

export async function dispatchRoomVoiceStageRoutes(request, url, h) {
  const path = url.pathname;
  const configMatch = path.match(/^\/rooms\/([^/]+)\/stage$/);
  const voiceTokenMatch = path.match(/^\/rooms\/([^/]+)\/voice\/token$/);
  const stageGetMatch = path.match(/^\/rooms\/([^/]+)\/voice-stage$/);
  const stageActionMatch = path.match(/^\/rooms\/([^/]+)\/voice-stage\/(join|leave|role|mute|request-speak)$/);
  if (!configMatch && !voiceTokenMatch && !stageGetMatch && !stageActionMatch) return null;

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

  const roomId = decodeURIComponent(
    (configMatch || voiceTokenMatch || stageGetMatch || stageActionMatch)[1],
  );
  const canAccess = await canAccessRoom(env, auth, roomId);
  if (!canAccess) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

  try {
    if (voiceTokenMatch && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const token = await generateToken(env, body.provider, {
        roomId,
        roomName: body.roomName,
        userId: auth.userId,
        displayName: body.displayName,
        ttl: body.ttl,
        canPublish: body.canPublish,
        canSubscribe: body.canSubscribe,
      });
      return json({ ok: true, token }, { headers: corsHeaders });
    }

    if (stageGetMatch && request.method === "GET") {
      try {
        const id = env.ROOM.idFromName(roomId);
        const stub = env.ROOM.get(id);
        const res = await stub.fetch("https://internal/stage-snapshot");
        const payload = await res.json().catch(() => ({ ok: true, stage: null }));
        return json(payload, { headers: corsHeaders });
      } catch {
        return json({ ok: true, stage: null }, { headers: corsHeaders });
      }
    }

    if (stageActionMatch && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const action = stageActionMatch[2];
      const op =
        action === "request-speak" ? "requestSpeak"
          : action === "join" ? "join"
            : action === "leave" ? "leave"
              : action === "mute" ? "mute"
                : "role";
      const result = await runRoomStageCommand(env, roomId, {
        op,
        userId: auth.userId,
        role: body.role,
        displayName: body.displayName,
        muted: body.muted,
      });
      return json(result, { status: result.ok ? 200 : 400, headers: corsHeaders });
    }

    if (configMatch && request.method === "GET") {
      const config = await getVoiceStageConfig(env, { projectId: auth.projectId, roomId });
      return json({ ok: true, config }, { headers: corsHeaders });
    }

    if (configMatch && (request.method === "POST" || request.method === "PUT")) {
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
