import { pickRouteDeps } from "./route-http-deps.js";
import { canAccessRoom } from "../lib/room-access.js";
import {
  pinMessage,
  unpinMessage,
  listPins,
  getPinStats,
} from "../lib/pinned-messages.js";

export async function dispatchPinnedMessagesRoutes(request, url, h) {
  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
  } = pickRouteDeps(h, [
    "env", "json", "corsHeaders", "requestLogCtx", "verifyJwtAndGetContext", "logError",
  ]);

  const pinsMatch = url.pathname.match(/^\/rooms\/([^/]+)$/);
  const pinByIdMatch = url.pathname.match(/^\/rooms\/([^/]+)\/pins$/);
  const pinMsgMatch = url.pathname.match(/^\/rooms\/([^/]+)\/pins\/(\d+)$/);
  const statsMatch = url.pathname === "/admin/pins/stats";

  if (!pinsMatch && !pinByIdMatch && !pinMsgMatch && !statsMatch) return null;

  // Only handle GET/POST for /rooms/:id/pins and DELETE for /rooms/:id/pins/:msgId
  const isPinsEndpoint = pinByIdMatch && (request.method === "GET" || request.method === "POST");
  const isPinDelete = pinMsgMatch && request.method === "DELETE";
  const isStatsEndpoint = statsMatch && request.method === "GET";

  if (!isPinsEndpoint && !isPinDelete && !isStatsEndpoint) return null;

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  try {
    /* ── GET /rooms/:id/pins ── */
    if (isPinsEndpoint && request.method === "GET") {
      const roomId = pinByIdMatch[1];
      const canAccess = await canAccessRoom(env, auth, roomId);
      if (!canAccess) return json({ error: "forbidden" }, { status: 403 });

      const category = url.searchParams.get("category");
      const limit = url.searchParams.get("limit");
      const result = await listPins(env, {
        projectId: auth.projectId,
        roomId,
        category: category || undefined,
        limit: limit ? Number(limit) : undefined,
      });
      return json(result, { headers: corsHeaders });
    }

    /* ── POST /rooms/:id/pins ── */
    if (isPinsEndpoint && request.method === "POST") {
      const roomId = pinByIdMatch[1];
      const canAccess = await canAccessRoom(env, auth, roomId);
      if (!canAccess) return json({ error: "forbidden" }, { status: 403 });

      const body = await request.json().catch(() => null);
      const result = await pinMessage(env, {
        projectId: auth.projectId,
        roomId,
        messageId: body?.messageId,
        pinnedBy: auth.userId,
        category: body?.category,
      });

      if (!result.ok) {
        const status = result.error === "message_not_found" ? 404 :
          result.error === "already_pinned" ? 409 :
          result.error === "max_pins_reached" ? 400 : 400;
        return json(result, { status, headers: corsHeaders });
      }
      return json(result, { status: 201, headers: corsHeaders });
    }

    /* ── DELETE /rooms/:id/pins/:messageId ── */
    if (isPinDelete) {
      const roomId = pinMsgMatch[1];
      const messageId = Number(pinMsgMatch[2]);
      const canAccess = await canAccessRoom(env, auth, roomId);
      if (!canAccess) return json({ error: "forbidden" }, { status: 403 });

      const result = await unpinMessage(env, {
        projectId: auth.projectId,
        roomId,
        messageId,
      });

      if (!result.ok) {
        const status = result.error === "not_pinned" ? 404 : 400;
        return json(result, { status, headers: corsHeaders });
      }
      return json(result, { headers: corsHeaders });
    }

    /* ── GET /admin/pins/stats ── */
    if (isStatsEndpoint) {
      if (!auth.roles?.includes("admin")) {
        return json({ error: "admin_required" }, { status: 403, headers: corsHeaders });
      }
      const result = await getPinStats(env, { projectId: auth.projectId });
      return json(result, { headers: corsHeaders });
    }

    return null;
  } catch (err) {
    logError("pinned_messages.unhandled", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
