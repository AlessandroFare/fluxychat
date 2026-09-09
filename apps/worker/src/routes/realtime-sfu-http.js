import { pickRouteDeps } from "./route-http-deps.js";
import { canAccessRoom } from "../lib/room-access.js";
import {
  addRealtimeSfuTracks,
  createRealtimeSfuSession,
  isRealtimeSfuConfigured,
  renegotiateRealtimeSfuSession,
} from "../lib/realtime-sfu.js";
import { checkAndConsumeRateLimit } from "../lib/rate-limit.js";
import {
  announceHuddleSfuTracks,
  listHuddleSfuTracks,
  sanitizeSfuRenegotiatePayload,
  sanitizeSfuSessionPayload,
  sanitizeSfuTracksPayload,
  withdrawHuddleSfuTracks,
} from "../lib/huddle-sfu-tracks.js";
import {
  assertHuddleSfuBudget,
  assertLocalPublishAllowed,
  beginHuddleSfuSession,
  huddleSfuBudgetSnapshot,
  markHuddleSfuVideo,
  settleHuddleSfuSession,
} from "../lib/huddle-sfu-budget.js";

function badRequest(err) {
  return err instanceof Error ? err.message : "invalid_payload";
}

export async function dispatchRealtimeSfuRoutes(request, url, h) {
  const createMatch = url.pathname.match(/^\/rooms\/([^/]+)\/realtime\/sessions$/);
  const tracksMatch = url.pathname.match(/^\/rooms\/([^/]+)\/realtime\/sessions\/([^/]+)\/tracks$/);
  const renegotiateMatch = url.pathname.match(/^\/rooms\/([^/]+)\/realtime\/sessions\/([^/]+)\/renegotiate$/);
  const rosterMatch = url.pathname.match(/^\/rooms\/([^/]+)\/realtime\/tracks$/);
  const budgetMatch = url.pathname.match(/^\/rooms\/([^/]+)\/realtime\/budget$/);
  if (!createMatch && !tracksMatch && !renegotiateMatch && !rosterMatch && !budgetMatch) return null;

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

  const roomId = decodeURIComponent((createMatch || tracksMatch || renegotiateMatch || rosterMatch || budgetMatch)[1]);
  const allowed = await canAccessRoom(env, auth, roomId);
  if (!allowed) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

  if (!isRealtimeSfuConfigured(env)) {
    return json({ error: "realtime_sfu_not_configured" }, { status: 503, headers: corsHeaders });
  }

  try {
    if (budgetMatch && request.method === "GET") {
      const snapshot = await huddleSfuBudgetSnapshot(env);
      return json({ ...snapshot, estimated: true }, { status: 200, headers: corsHeaders });
    }

    if (rosterMatch && request.method === "GET") {
      const tracks = await listHuddleSfuTracks(env, {
        projectId: auth.projectId,
        roomId,
        userId: auth.userId,
      });
      return json({ tracks }, { status: 200, headers: corsHeaders });
    }

    if (rosterMatch && request.method === "DELETE") {
      await settleHuddleSfuSession(env, {
        projectId: auth.projectId,
        roomId,
        userId: auth.userId,
      });
      await withdrawHuddleSfuTracks(env, {
        projectId: auth.projectId,
        roomId,
        userId: auth.userId,
      });
      return json({ ok: true }, { status: 200, headers: corsHeaders });
    }

    if (rosterMatch && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const hasVideo = (body.tracks || []).some((t) => t.kind === "video");
      const gate = await assertHuddleSfuBudget(env, { hasVideo });
      if (!gate.ok) {
        return json(
          { error: "quota_exceeded", reason: gate.reason, snapshot: gate.snapshot },
          { status: 429, headers: corsHeaders },
        );
      }
      await announceHuddleSfuTracks(env, {
        projectId: auth.projectId,
        roomId,
        userId: auth.userId,
        sessionId: body.sessionId,
        tracks: body.tracks,
      });
      if (hasVideo && body.sessionId) {
        await markHuddleSfuVideo(env, { sessionId: body.sessionId });
      }
      return json({ ok: true }, { status: 201, headers: corsHeaders });
    }

    if (createMatch && request.method === "POST") {
      const quota = await checkAndConsumeRateLimit(env, {
        key: `huddle-sfu:${auth.projectId}:${roomId}:${auth.userId}`,
        limit: 20,
        windowSeconds: 3600,
      });
      if (!quota.allowed) {
        return json(
          { error: "quota_exceeded", reason: "hourly", retryAfterSeconds: quota.retryAfterSeconds },
          { status: 429, headers: corsHeaders },
        );
      }
      const gate = await assertHuddleSfuBudget(env, { hasVideo: false });
      if (!gate.ok) {
        return json(
          { error: "quota_exceeded", reason: gate.reason, snapshot: gate.snapshot },
          { status: 429, headers: corsHeaders },
        );
      }
      const body = await request.json().catch(() => ({}));
      let payload;
      try {
        payload = sanitizeSfuSessionPayload(body);
      } catch (err) {
        return json({ error: "invalid_payload", message: badRequest(err) }, { status: 400, headers: corsHeaders });
      }
      const result = await createRealtimeSfuSession(env, payload);
      if (result.ok && result.data?.sessionId) {
        await beginHuddleSfuSession(env, {
          sessionId: result.data.sessionId,
          projectId: auth.projectId,
          roomId,
          userId: auth.userId,
          hasVideo: false,
        });
      }
      const status = result.ok ? 201 : result.status || 502;
      return json(result.ok ? { ...result, snapshot: gate.snapshot } : result, { status, headers: corsHeaders });
    }

    if (tracksMatch && request.method === "POST") {
      const sessionId = decodeURIComponent(tracksMatch[2]);
      const body = await request.json().catch(() => ({}));
      let payload;
      try {
        payload = sanitizeSfuTracksPayload(body);
      } catch (err) {
        return json({ error: "invalid_payload", message: badRequest(err) }, { status: 400, headers: corsHeaders });
      }
      const publishGate = assertLocalPublishAllowed(env, payload.tracks);
      if (!publishGate.ok) {
        return json(
          { error: "quota_exceeded", reason: publishGate.reason },
          { status: 429, headers: corsHeaders },
        );
      }
      const result = await addRealtimeSfuTracks(env, sessionId, payload);
      const status = result.ok ? 200 : result.status || 502;
      return json(result, { status, headers: corsHeaders });
    }

    if (renegotiateMatch && request.method === "PUT") {
      const sessionId = decodeURIComponent(renegotiateMatch[2]);
      const body = await request.json().catch(() => ({}));
      let payload;
      try {
        payload = sanitizeSfuRenegotiatePayload(body);
      } catch (err) {
        return json({ error: "invalid_payload", message: badRequest(err) }, { status: 400, headers: corsHeaders });
      }
      const result = await renegotiateRealtimeSfuSession(env, sessionId, payload);
      const status = result.ok ? 200 : result.status || 502;
      return json(result, { status, headers: corsHeaders });
    }

    return json({ error: "method_not_allowed" }, { status: 405, headers: corsHeaders });
  } catch (err) {
    logError("realtime_sfu.unhandled", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
