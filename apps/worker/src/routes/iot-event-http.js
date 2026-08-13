import { pickRouteDeps } from "./route-http-deps.js";
import { canAccessRoom } from "../lib/room-access.js";
import { ingestIotDeviceEvent } from "../lib/iot-event-bus.js";

/** NW-206 POST /rooms/:id/iot/events */
export async function dispatchIotEventRoutes(request, url, h) {
  const match = url.pathname.match(/^\/rooms\/([^/]+)\/iot\/events$/);
  if (!match || request.method !== "POST") return null;

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

  const roomId = decodeURIComponent(match[1]);
  const allowed = await canAccessRoom(env, auth, roomId);
  if (!allowed) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

  try {
    const body = await request.json().catch(() => ({}));
    const deviceId = String(body.deviceId || "").trim();
    const eventType = String(body.eventType || body.type || "telemetry").trim();
    if (!deviceId) return json({ error: "deviceId required" }, { status: 400, headers: corsHeaders });

    const result = await ingestIotDeviceEvent(env, {
      projectId: auth.projectId,
      roomId,
      deviceId,
      eventType,
      payload: body.payload ?? body.data ?? {},
      actorUserId: body.actorUserId,
    });
    return json(result, { status: result.ok ? 201 : 400, headers: corsHeaders });
  } catch (err) {
    logError("iot.event_route_failed", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
