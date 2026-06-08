import { pickRouteDeps } from "./route-http-deps.js";
import { canAccessRoom } from "../lib/room-access.js";
import {
  getRoomHandoffState,
  requestHumanHandoff,
  resolveRoomHandoff,
} from "../lib/room-handoff.js";
import { canAccessAgentQueue } from "../lib/agent-queue.js";
import { listAgentDispositions } from "../lib/agent-dispositions.js";

export async function dispatchHandoffRoutes(request, url, h) {
  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
    isValidId,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "logError",
    "isValidId",
  ]);

  const handoffMatch = url.pathname.match(/^\/rooms\/([^/]+)\/handoff$/);
  if (!handoffMatch) return null;

  const roomId = decodeURIComponent(handoffMatch[1]);
  if (!isValidId(roomId)) {
    return json({ error: "invalid_room_id" }, { status: 400, headers: corsHeaders });
  }

  if (request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const allowed = await canAccessRoom(env, auth, roomId);
    if (!allowed) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }
    const handoff = await getRoomHandoffState(env, auth.projectId, roomId);
    return json(
      {
        handoff,
        dispositions: canAccessAgentQueue(auth.roles) ? listAgentDispositions() : undefined,
      },
      { headers: corsHeaders },
    );
  }

  if (request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!canAccessAgentQueue(auth.roles)) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }
    const allowed = await canAccessRoom(env, auth, roomId);
    if (!allowed) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }

    const body = await request.json().catch(() => null);
    const result = await requestHumanHandoff(env, {
      projectId: auth.projectId,
      roomId,
      userId: auth.userId,
      roles: auth.roles,
      agentId: typeof body?.agentId === "string" ? body.agentId.trim() : null,
      note: typeof body?.note === "string" ? body.note : null,
    });
    if (!result.ok) {
      return json({ error: result.error }, { status: 403, headers: corsHeaders });
    }
    return json(result, { status: result.alreadyActive ? 200 : 201, headers: corsHeaders });
  }

  if (request.method === "PATCH") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!canAccessAgentQueue(auth.roles)) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }
    const allowed = await canAccessRoom(env, auth, roomId);
    if (!allowed) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }

    const body = await request.json().catch(() => null);
    const result = await resolveRoomHandoff(env, {
      projectId: auth.projectId,
      roomId,
      userId: auth.userId,
      roles: auth.roles,
      disposition: typeof body?.disposition === "string" ? body.disposition : null,
    });
    if (!result.ok) {
      const status =
        result.error === "no_active_handoff"
          ? 404
          : result.error === "disposition_required" || result.error === "invalid_disposition"
            ? 400
            : 403;
      return json({ error: result.error }, { status, headers: corsHeaders });
    }
    return json({ ok: true, ...result }, { headers: corsHeaders });
  }

  return null;
}
