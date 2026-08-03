import { pickRouteDeps } from "./route-http-deps.js";
import {
  getRoomFirmware,
  upsertRoomFirmware,
  listFirmwareAudit,
} from "../lib/room-firmware.js";

export async function dispatchRoomFirmwareRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.includes("/firmware")) return null;

  const {
    env,
    json,
    corsHeaders,
    verifyJwtAndGetContext,
    hasAnyRole,
    canAccessRoom,
    logError,
    requestLogCtx,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "verifyJwtAndGetContext",
    "hasAnyRole",
    "canAccessRoom",
    "logError",
    "requestLogCtx",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  try {
    const settingsMatch = path.match(/^\/rooms\/([^/]+)\/firmware$/);
    if (settingsMatch) {
      const roomId = decodeURIComponent(settingsMatch[1]);
      const allowed = await canAccessRoom(env, auth, roomId);
      if (!allowed) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

      if (request.method === "GET") {
        const firmware = await getRoomFirmware(env, auth.projectId, roomId);
        return json({ ok: true, firmware }, { headers: corsHeaders });
      }

      if (request.method === "PUT" || request.method === "PATCH") {
        if (!hasAnyRole(auth.roles, ["owner", "admin", "moderator"])) {
          return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
        }
        const body = await request.json().catch(() => ({}));
        const firmware = await upsertRoomFirmware(env, {
          projectId: auth.projectId,
          roomId,
          userId: auth.userId,
          patch: { ...body, bumpVersion: true },
        });
        return json({ ok: true, firmware }, { headers: corsHeaders });
      }
    }

    const auditMatch = path.match(/^\/rooms\/([^/]+)\/firmware\/audit$/);
    if (auditMatch && request.method === "GET") {
      const roomId = decodeURIComponent(auditMatch[1]);
      const allowed = await canAccessRoom(env, auth, roomId);
      if (!allowed) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
      const audit = await listFirmwareAudit(env, {
        projectId: auth.projectId,
        roomId,
        limit: Number(url.searchParams.get("limit") || 50),
      });
      return json({ ok: true, audit }, { headers: corsHeaders });
    }

    return null;
  } catch (err) {
    logError("room_firmware.route_failed", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
