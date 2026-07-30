import { pickRouteDeps } from "./route-http-deps.js";
import { createStreamResumptionStore } from "../lib/stream-resumption.js";

function getResumptionStore(env) {
  const kv = env.RATE_LIMIT_KV ?? env.STREAM_RESUME_KV;
  if (!kv) return null;
  return createStreamResumptionStore(kv);
}

export async function dispatchAiStreamRoutes(request, url, h) {
  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "logError",
  ]);

  const resumeMatch = url.pathname.match(/^\/ai\/streams\/([^/]+)\/resume$/);
  if (resumeMatch && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const store = getResumptionStore(env);
    if (!store) {
      return json({ error: "stream_resume_unavailable", message: "KV binding not configured" }, { status: 503, headers: corsHeaders });
    }

    const streamId = decodeURIComponent(resumeMatch[1]);
    const entry = await store.get(streamId);
    if (!entry || entry.projectId !== auth.projectId) {
      return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
    }

    return json(
      {
        streamId: entry.streamId,
        roomId: entry.roomId,
        agentId: entry.agentId,
        runId: entry.runId,
        content: entry.content ?? "",
        active: entry.active === true,
        startedAt: entry.startedAt,
        lastActivityAt: entry.lastActivityAt,
        fromOffset: 0,
      },
      { headers: corsHeaders },
    );
  }

  const chunkMatch = url.pathname.match(/^\/ai\/streams\/([^/]+)\/chunk$/);
  if (chunkMatch && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const store = getResumptionStore(env);
    if (!store) {
      return json({ ok: true, persisted: false }, { headers: corsHeaders });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid_json" }, { status: 400, headers: corsHeaders });
    }

    const streamId = decodeURIComponent(chunkMatch[1]);
    const text = typeof body.text === "string" ? body.text : "";
    const existing = await store.get(streamId);
    const entry = existing ?? {
      streamId,
      projectId: auth.projectId,
      userId: auth.userId,
      roomId: body.roomId ?? null,
      agentId: body.agentId ?? null,
      runId: body.runId ?? body.sessionId ?? null,
      content: "",
      active: true,
      startedAt: new Date().toISOString(),
    };

    if (existing && existing.projectId && existing.projectId !== auth.projectId) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }

    entry.projectId = auth.projectId;
    entry.content = `${entry.content ?? ""}${text}`;
    entry.active = true;
    entry.lastActivityAt = new Date().toISOString();
    await store.save(entry);

    return json({ ok: true, streamId, offset: body.offset ?? null }, { headers: corsHeaders });
  }

  if (url.pathname === "/ai/streams/active" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const store = getResumptionStore(env);
    if (!store) {
      return json({ streams: [] }, { headers: corsHeaders });
    }

    const roomId = url.searchParams.get("roomId");
    const streams = roomId
      ? await store.getActiveForRoom(roomId)
      : await store.getActiveForUser(auth.userId);

    const filtered = streams.filter((s) => s.projectId === auth.projectId);
    return json({ streams: filtered }, { headers: corsHeaders });
  }

  return null;
}
