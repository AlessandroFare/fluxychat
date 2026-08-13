import { pickRouteDeps } from "./route-http-deps.js";
import { getRoomConfig, patchRoomConfig } from "../lib/room-config.js";
import { listRoomTimelineEvents } from "../lib/room-timeline-events.js";
import { fanoutRoomInternal } from "../lib/room-shard.js";

export async function dispatchRoomConfigRoutes(request, url, h) {
  const configMatch = url.pathname.match(/^\/rooms\/([^/]+)\/config$/);
  const timelineMatch = url.pathname.match(/^\/rooms\/([^/]+)\/timeline-events$/);
  if (!configMatch && !timelineMatch) return null;

  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
    hasAnyRole,
    canAccessRoom,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "logError",
    "hasAnyRole",
    "canAccessRoom",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const roomId = decodeURIComponent((configMatch || timelineMatch)[1]);
  const allowed = await canAccessRoom(env, auth, roomId);
  if (!allowed) {
    return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
  }

  if (timelineMatch && request.method === "GET") {
    const eventType = url.searchParams.get("eventType") || undefined;
    const limit = url.searchParams.get("limit");
    const events = await listRoomTimelineEvents(env, {
      projectId: auth.projectId,
      roomId,
      eventType,
      limit: limit ? Number(limit) : undefined,
    });
    return json({ events }, { headers: corsHeaders });
  }

  if (configMatch && request.method === "GET") {
    const result = await getRoomConfig(env, { projectId: auth.projectId, roomId });
    return json({ roomId, ...result }, { headers: corsHeaders });
  }

  if (configMatch && request.method === "PATCH") {
    if (!hasAnyRole(auth.roles, ["owner", "admin", "moderator"])) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }
    const body = await request.json().catch(() => ({}));
    const result = await patchRoomConfig(env, {
      projectId: auth.projectId,
      roomId,
      patch: body?.config ?? body,
      changedBy: auth.userId,
    });
    if (!result.ok) {
      return json({ error: result.error }, { status: 400, headers: corsHeaders });
    }

    if (body?.config?.approvalChain !== undefined || body?.approvalChain !== undefined) {
      try {
        await fanoutRoomInternal(env, auth.projectId, roomId, "/announce", {
          type: "server_event",
          event: {
            type: "approval_chain_updated",
            roomId,
            changedBy: auth.userId,
            newChain: result.config.approvalChain,
            timestamp: result.updatedAt,
          },
        });
      } catch {
        /* non-fatal */
      }
    }

    return json({ roomId, config: result.config, updatedAt: result.updatedAt, updatedBy: result.updatedBy }, {
      headers: corsHeaders,
    });
  }

  return json({ error: "method_not_allowed" }, { status: 405, headers: corsHeaders });
}
