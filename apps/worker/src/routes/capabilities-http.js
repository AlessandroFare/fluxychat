import { pickRouteDeps } from "./route-http-deps.js";
import { canAccessRoom } from "../lib/room-access.js";
import { publishCapabilityEvent, listCapabilityEvents } from "../lib/capability-platform.js";

/**
 * Capability platform HTTP routes:
 *   POST /rooms/:roomId/capabilities/events
 *   GET  /rooms/:roomId/capabilities/events
 */
export async function dispatchCapabilitiesRoutes(request, url, h) {
  const {
    env, json, corsHeaders, verifyJwtAndGetContext, logError, requestLogCtx,
  } = pickRouteDeps(h, [
    "env", "json", "corsHeaders", "verifyJwtAndGetContext", "logError", "requestLogCtx",
  ]);

  const eventsMatch = url.pathname.match(/^\/rooms\/([^/]+)\/capabilities\/events$/);
  if (!eventsMatch) return null;

  const roomId = eventsMatch[1];
  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  try {
    if (request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== "object") {
        return json({ error: "invalid_body" }, { status: 400, headers: corsHeaders });
      }
      const result = await publishCapabilityEvent(env, {
        roomId,
        vertical: body.vertical,
        type: body.type,
        actor: body.actor,
        idempotencyKey: body.idempotencyKey,
        payload: body.payload,
        occurredAt: body.occurredAt,
      }, auth);

      if (!result.ok) {
        const status = result.error === "forbidden" || result.error === "policy_denied" ? 403 : 400;
        return json(result, { status, headers: corsHeaders });
      }
      return json(result, { status: result.deduplicated ? 200 : 201, headers: corsHeaders });
    }

    if (request.method === "GET") {
      const canAccess = await canAccessRoom(env, auth, roomId);
      if (!canAccess) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

      const afterCursor = Number(url.searchParams.get("afterCursor") || "0");
      const limit = Number(url.searchParams.get("limit") || "100");
      const result = await listCapabilityEvents(env, { roomId, afterCursor, limit }, auth);
      return json(result, { headers: corsHeaders });
    }

    return null;
  } catch (err) {
    logError("capabilities.unhandled", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
