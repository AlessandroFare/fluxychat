import { pickRouteDeps } from "./route-http-deps.js";
import { resolveAdminContext } from "../lib/admin-route-context.js";
import { canAccessRoom } from "../lib/room-access.js";
import { fanoutRoomInternal } from "../lib/room-shard.js";
import { FEATURE_FLAG_KEYS, requireFeatureFlag } from "../lib/feature-flags.js";
import {
  listVoiceAiProviders,
  createVoiceAiSession,
  recordVoiceAiMetrics,
  getVoiceAiMetrics,
  getVoiceAiStats,
} from "../lib/voice-ai-pipeline.js";
import { transcribeAudio } from "../lib/voice-messages.js";
import {
  decodeAudioBase64,
  synthesizeWithWorkersAi,
} from "../lib/workers-ai-speech.js";
import { safeOutboundFetch } from "../lib/url-ssrf.js";

export async function dispatchVoiceAiRoutes(request, url, h) {
  const path = url.pathname;

  if (request.method === "GET" && path === "/voice-ai/providers") {
    const { json: respond } = pickRouteDeps(h, ["json"]);
    return respond({ providers: listVoiceAiProviders() }, h);
  }

  if (
    request.method === "POST" &&
    (path === "/voice-ai/transcribe" || path === "/voice-ai/speak" || path === "/voice-ai/clone-translate")
  ) {
    return dispatchMemberSpeech(request, path, h);
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

async function dispatchMemberSpeech(request, path, h) {
  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
    checkAndConsumeRateLimit,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "logError",
    "checkAndConsumeRateLimit",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const voiceFlag = await requireFeatureFlag(env, FEATURE_FLAG_KEYS.VOICE_MESSAGES, {
    userId: auth.userId,
    projectId: auth.projectId,
  });
  if (!voiceFlag.ok) {
    return json(
      { error: voiceFlag.error, flag: voiceFlag.flag },
      { status: 503, headers: corsHeaders },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return json({ error: "json body required" }, { status: 400, headers: corsHeaders });
  }

  const roomId = typeof body.roomId === "string" && body.roomId ? body.roomId : null;
  if (roomId) {
    const allowed = await canAccessRoom(env, auth, roomId);
    if (!allowed) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }
  }

  const rate = await checkAndConsumeRateLimit(env, {
    key: `voice-ai:${path}:${auth.projectId}:${auth.userId}`,
    limit: Number(env.RATE_LIMIT_VOICE_AI_PER_MINUTE || 20),
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return json(
      { error: "rate_limit_exceeded", retryAfterSeconds: rate.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds), ...corsHeaders } },
    );
  }

  if (path === "/voice-ai/transcribe") {
    const decoded = decodeAudioBase64(body.audioBase64);
    if (!decoded.ok) {
      return json({ error: decoded.error }, { status: decoded.status, headers: corsHeaders });
    }
    const mimeType = typeof body.mimeType === "string" ? body.mimeType : "audio/webm";
    const language = typeof body.language === "string" ? body.language : undefined;
    const result = await transcribeAudio(env, {
      audioBytes: decoded.audioBytes,
      mimeType,
      language,
    });
    if (!result.ok) {
      return json({ error: result.error }, { status: result.status, headers: corsHeaders });
    }
    if (roomId && body.announce === true) {
      await fanoutRoomInternal(env, auth.projectId, roomId, "/announce", {
        method: "POST",
        body: JSON.stringify({
          type: "voice_ai_transcript",
          roomId,
          userId: auth.userId,
          text: result.text,
          model: result.model,
          engine: result.engine || "workers-ai",
        }),
      });
    }
    return json(
      {
        ok: true,
        text: result.text,
        model: result.model,
        engine: result.engine || null,
      },
      { headers: corsHeaders },
    );
  }

  if (path === "/voice-ai/clone-translate") {
    const cloneUrl = String(env.VOICE_CLONE_URL || "").trim();
    if (!cloneUrl) {
      return json(
        { error: "voice_clone_unconfigured", hint: "Set VOICE_CLONE_URL on the Worker" },
        { status: 503, headers: corsHeaders },
      );
    }
    const audioBase64 = typeof body.audioBase64 === "string" ? body.audioBase64 : "";
    if (!audioBase64) {
      return json({ error: "audioBase64 required" }, { status: 400, headers: corsHeaders });
    }
    const payload = {
      audioBase64,
      targetLang: typeof body.targetLang === "string" ? body.targetLang : "en",
      voiceId: typeof body.voiceId === "string" ? body.voiceId : null,
      projectId: auth.projectId,
      userId: auth.userId,
      roomId,
    };
    let upstream;
    try {
      upstream = await safeOutboundFetch(
        cloneUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(env.VOICE_CLONE_API_KEY
              ? { Authorization: `Bearer ${String(env.VOICE_CLONE_API_KEY).trim()}` }
              : {}),
          },
          body: JSON.stringify(payload),
        },
        env,
      );
    } catch (err) {
      logError("voice_ai.clone_translate_failed", err, requestLogCtx);
      return json({ error: "voice_clone_unreachable" }, { status: 502, headers: corsHeaders });
    }
    const cloned = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      return json(
        { error: "voice_clone_upstream", status: upstream.status, detail: cloned },
        { status: 502, headers: corsHeaders },
      );
    }
    return json({ ok: true, ...(cloned && typeof cloned === "object" ? cloned : {}) }, { headers: corsHeaders });
  }

  const text = typeof body.text === "string" ? body.text : "";
  const result = await synthesizeWithWorkersAi(env, {
    text,
    lang: typeof body.lang === "string" ? body.lang : undefined,
    voice: typeof body.voice === "string" ? body.voice : undefined,
  });
  if (!result.ok) {
    return json({ error: result.error }, { status: result.status, headers: corsHeaders });
  }
  if (roomId && body.announce === true) {
    await fanoutRoomInternal(env, auth.projectId, roomId, "/announce", {
      method: "POST",
      body: JSON.stringify({
        type: "voice_ai_speak",
        roomId,
        userId: auth.userId,
        text,
        model: result.model,
        engine: result.engine,
      }),
    });
  }
  return json(
    {
      ok: true,
      audioBase64: result.audioBase64,
      mimeType: result.mimeType,
      model: result.model,
      engine: result.engine,
    },
    { headers: corsHeaders },
  );
}
