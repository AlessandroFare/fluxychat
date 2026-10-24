import { pickRouteDeps } from "./route-http-deps.js";
import {
  createRoomBookmark,
  deleteRoomBookmark,
  listRoomBookmarks,
} from "../lib/room-bookmarks.js";

/**
 * Channel bookmarks — shared links pinned to a room.
 * GET    /rooms/:roomId/bookmarks
 * POST   /rooms/:roomId/bookmarks
 * DELETE /rooms/:roomId/bookmarks/:id
 */
export async function dispatchRoomBookmarksRoutes(request, url, h) {
  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    hasAnyRole,
    canAccessRoom,
    isValidId,
    logError,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "hasAnyRole",
    "canAccessRoom",
    "isValidId",
    "logError",
  ]);

  const listMatch = url.pathname.match(/^\/rooms\/([^/]+)\/bookmarks$/);
  const itemMatch = url.pathname.match(/^\/rooms\/([^/]+)\/bookmarks\/([^/]+)$/);
  if (!listMatch && !itemMatch) return null;

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const roomId = decodeURIComponent((listMatch || itemMatch)[1]);
  if (!isValidId(roomId)) {
    return json({ error: "invalid_room" }, { status: 400, headers: corsHeaders });
  }

  try {
    const allowed = await canAccessRoom(env, auth, roomId);
    if (!allowed) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    if (listMatch && request.method === "GET") {
      const { bookmarks } = await listRoomBookmarks(env, {
        projectId: auth.projectId,
        roomId,
      });
      return json({ bookmarks, count: bookmarks.length }, { headers: corsHeaders });
    }

    if (listMatch && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const result = await createRoomBookmark(env, {
        projectId: auth.projectId,
        roomId,
        label: body?.label,
        url: body?.url,
        createdBy: auth.userId,
      });
      if (!result.ok) {
        return json({ error: result.error }, { status: result.status || 400, headers: corsHeaders });
      }
      return json(result, { status: 201, headers: corsHeaders });
    }

    if (itemMatch && request.method === "DELETE") {
      const result = await deleteRoomBookmark(env, {
        projectId: auth.projectId,
        roomId,
        id: decodeURIComponent(itemMatch[2]),
        actorUserId: auth.userId,
        privileged: hasAnyRole(auth.roles || [], ["owner", "admin"]),
      });
      if (!result.ok) {
        return json({ error: result.error }, { status: result.status || 400, headers: corsHeaders });
      }
      return json(result, { headers: corsHeaders });
    }

    return null;
  } catch (err) {
    logError("room_bookmarks.route_error", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
