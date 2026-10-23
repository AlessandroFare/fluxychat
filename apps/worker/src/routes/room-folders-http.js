import { pickRouteDeps } from "./route-http-deps.js";
import {
  createRoomFolder,
  deleteRoomFolder,
  listRoomFolders,
  removeRoomFolderItem,
  renameRoomFolder,
  setRoomFolderItem,
} from "../lib/room-folders.js";

/**
 * Per-user room folders (sidebar sections).
 * GET    /room-folders
 * POST   /room-folders
 * PATCH  /room-folders/:id
 * DELETE /room-folders/:id
 * POST   /room-folders/:id/rooms
 * DELETE /room-folders/:id/rooms/:roomId
 */
export async function dispatchRoomFoldersRoutes(request, url, h) {
  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "logError",
  ]);

  const listMatch = url.pathname === "/room-folders";
  const roomsMatch = url.pathname.match(/^\/room-folders\/([^/]+)\/rooms$/);
  const roomMatch = url.pathname.match(/^\/room-folders\/([^/]+)\/rooms\/([^/]+)$/);
  const itemMatch = url.pathname.match(/^\/room-folders\/([^/]+)$/);
  if (!listMatch && !roomsMatch && !roomMatch && !itemMatch) return null;

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  try {
    if (listMatch && request.method === "GET") {
      const { folders } = await listRoomFolders(env, {
        projectId: auth.projectId,
        userId: auth.userId,
      });
      return json({ folders, count: folders.length }, { headers: corsHeaders });
    }

    if (listMatch && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const result = await createRoomFolder(env, {
        projectId: auth.projectId,
        userId: auth.userId,
        name: body?.name,
      });
      if (!result.ok) {
        return json({ error: result.error }, { status: result.status || 400, headers: corsHeaders });
      }
      return json(result, { status: 201, headers: corsHeaders });
    }

    if (itemMatch && request.method === "PATCH") {
      const body = await request.json().catch(() => null);
      const result = await renameRoomFolder(env, {
        projectId: auth.projectId,
        userId: auth.userId,
        folderId: decodeURIComponent(itemMatch[1]),
        name: body?.name,
      });
      if (!result.ok) {
        return json({ error: result.error }, { status: result.status || 400, headers: corsHeaders });
      }
      return json(result, { headers: corsHeaders });
    }

    if (itemMatch && request.method === "DELETE") {
      const result = await deleteRoomFolder(env, {
        projectId: auth.projectId,
        userId: auth.userId,
        folderId: decodeURIComponent(itemMatch[1]),
      });
      if (!result.ok) {
        return json({ error: result.error }, { status: result.status || 400, headers: corsHeaders });
      }
      return json(result, { headers: corsHeaders });
    }

    if (roomsMatch && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const result = await setRoomFolderItem(env, {
        projectId: auth.projectId,
        userId: auth.userId,
        folderId: decodeURIComponent(roomsMatch[1]),
        roomId: body?.roomId,
      });
      if (!result.ok) {
        return json({ error: result.error }, { status: result.status || 400, headers: corsHeaders });
      }
      return json(result, { headers: corsHeaders });
    }

    if (roomMatch && request.method === "DELETE") {
      const result = await removeRoomFolderItem(env, {
        projectId: auth.projectId,
        userId: auth.userId,
        folderId: decodeURIComponent(roomMatch[1]),
        roomId: decodeURIComponent(roomMatch[2]),
      });
      if (!result.ok) {
        return json({ error: result.error }, { status: result.status || 400, headers: corsHeaders });
      }
      return json(result, { headers: corsHeaders });
    }

    return null;
  } catch (err) {
    logError("room_folders.route_error", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
