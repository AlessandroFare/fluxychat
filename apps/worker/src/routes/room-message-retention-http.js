import { pickRouteDeps } from "./route-http-deps.js";
import {
  getRoomRetentionSettings,
  upsertRoomRetentionSettings,
  listRoomsWithRetention,
  purgeExpiredRoomMessages,
} from "../lib/message-retention-room.js";

export async function dispatchRoomMessageRetentionRoutes(request, url, h) {
  const {
    env,
    json,
    corsHeaders,
    verifyJwtAndGetContext,
    hasAnyRole,
    logError,
    requestLogCtx,
    canAccessRoom,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "verifyJwtAndGetContext",
    "hasAnyRole",
    "logError",
    "requestLogCtx",
    "canAccessRoom",
  ]);

  const listMatch = url.pathname === "/admin/room-message-retention";
  const roomMatch = url.pathname.match(/^\/rooms\/([^/]+)\/message-retention$/);
  const purgeMatch = url.pathname.match(/^\/admin\/rooms\/([^/]+)\/message-retention\/purge$/);

  if (!listMatch && !roomMatch && !purgeMatch) return null;

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  try {
    if (listMatch && request.method === "GET") {
      if (!hasAnyRole(auth.roles, ["owner", "admin", "moderator"])) {
        return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
      }
      const rooms = await listRoomsWithRetention(env, auth.projectId);
      return json({ ok: true, rooms }, { headers: corsHeaders });
    }

    if (roomMatch) {
      const roomId = decodeURIComponent(roomMatch[1]);
      const allowed = await canAccessRoom(env, auth, roomId);
      if (!allowed) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

      if (request.method === "GET") {
        const settings = await getRoomRetentionSettings(env, auth.projectId, roomId);
        return json({ ok: true, roomId, settings }, { headers: corsHeaders });
      }

      if (request.method === "PATCH") {
        if (!hasAnyRole(auth.roles, ["owner", "admin", "moderator"])) {
          return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
        }
        const body = await request.json().catch(() => ({}));
        const result = await upsertRoomRetentionSettings(env, auth.projectId, roomId, {
          mode: body.mode,
          ttlSeconds: body.ttlSeconds ?? body.ttl_seconds,
        });
        if (!result.ok) return json(result, { status: 400, headers: corsHeaders });
        return json({ ok: true, roomId, settings: result.settings }, { headers: corsHeaders });
      }
    }

    if (purgeMatch && request.method === "POST") {
      if (!hasAnyRole(auth.roles, ["owner", "admin"])) {
        return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
      }
      const roomId = decodeURIComponent(purgeMatch[1]);
      const result = await purgeExpiredRoomMessages(env, {
        projectId: auth.projectId,
        roomId,
        limit: 2000,
      });
      return json({ ok: true, roomId, ...result }, { headers: corsHeaders });
    }

    return null;
  } catch (err) {
    logError("room_message_retention.unhandled", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
