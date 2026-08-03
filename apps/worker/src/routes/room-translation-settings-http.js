import { pickRouteDeps } from "./route-http-deps.js";
import {
  getRoomTranslationSettings,
  listRoomsWithTranslationSettings,
  upsertRoomTranslationSettings,
} from "../lib/room-translation-settings.js";

export async function dispatchRoomTranslationSettingsRoutes(request, url, h) {
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

  const listMatch = url.pathname === "/admin/room-translation-settings";
  const roomMatch = url.pathname.match(/^\/rooms\/([^/]+)\/translation-settings$/);

  if (!listMatch && !roomMatch) return null;

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
      const rooms = await listRoomsWithTranslationSettings(env, auth.projectId);
      return json({ ok: true, rooms }, { headers: corsHeaders });
    }

    if (roomMatch) {
      const roomId = decodeURIComponent(roomMatch[1]);
      const allowed = await canAccessRoom(env, auth, roomId);
      if (!allowed) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

      if (request.method === "GET") {
        const settings = await getRoomTranslationSettings(env, auth.projectId, roomId);
        return json({ ok: true, roomId, settings }, { headers: corsHeaders });
      }

      if (request.method === "PATCH") {
        if (!hasAnyRole(auth.roles, ["owner", "admin", "moderator"])) {
          return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
        }
        const body = await request.json().catch(() => ({}));
        const result = await upsertRoomTranslationSettings(env, auth.projectId, roomId, {
          enabled: body.enabled,
          autoTranslateTarget: body.autoTranslateTarget ?? body.auto_translate_target,
        });
        if (!result.ok) return json(result, { status: 400, headers: corsHeaders });
        return json({ ok: true, roomId, settings: result.settings }, { headers: corsHeaders });
      }
    }
  } catch (err) {
    logError("room_translation_settings.route_failed", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }

  return json({ error: "method_not_allowed" }, { status: 405, headers: corsHeaders });
}
