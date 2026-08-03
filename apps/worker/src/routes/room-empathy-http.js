import { pickRouteDeps } from "./route-http-deps.js";
import {
  getRoomEmpathySettings,
  upsertRoomEmpathySettings,
  ingestProsodySignal,
} from "../lib/room-empathy.js";

export async function dispatchRoomEmpathyRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.includes("/empathy")) return null;

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
    const settingsMatch = path.match(/^\/rooms\/([^/]+)\/empathy\/settings$/);
    if (settingsMatch) {
      const roomId = decodeURIComponent(settingsMatch[1]);
      const allowed = await canAccessRoom(env, auth, roomId);
      if (!allowed) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

      if (request.method === "GET") {
        const settings = await getRoomEmpathySettings(env, auth.projectId, roomId);
        return json({ ok: true, settings }, { headers: corsHeaders });
      }

      if (request.method === "PATCH" || request.method === "PUT") {
        if (!hasAnyRole(auth.roles, ["owner", "admin", "moderator"])) {
          return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
        }
        const body = await request.json().catch(() => ({}));
        const settings = await upsertRoomEmpathySettings(env, auth.projectId, roomId, body);
        return json({ ok: true, settings }, { headers: corsHeaders });
      }
    }

    const signalMatch = path.match(/^\/rooms\/([^/]+)\/empathy\/signal$/);
    if (signalMatch && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const result = await ingestProsodySignal(env, auth, {
        roomId: decodeURIComponent(signalMatch[1]),
        ...body,
      });
      if (!result.ok) {
        const status = result.error === "forbidden" ? 403 : result.error === "empathy_disabled" ? 403 : 400;
        return json(result, { status, headers: corsHeaders });
      }
      return json(result, { headers: corsHeaders });
    }

    return null;
  } catch (err) {
    logError("room_empathy.route_failed", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
