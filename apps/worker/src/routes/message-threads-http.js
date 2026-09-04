/**
 * GET /threads — my participating reply trees
 * GET /rooms/:roomId/threads — Portal-style nested-thread registry (opaque cursor)
 */
import { pickRouteDeps } from "./route-http-deps.js";
import { listRoomThreads, listUserThreads } from "../lib/message-threads.js";

export async function dispatchMessageThreadsRoutes(request, url, h) {
  const roomMatch = url.pathname.match(/^\/rooms\/([^/]+)\/threads$/);
  const isMine = url.pathname === "/threads";
  if ((!roomMatch && !isMine) || request.method !== "GET") {
    return null;
  }

  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
    canAccessRoom,
    isValidId,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "logError",
    "canAccessRoom",
    "isValidId",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  if (roomMatch) {
    const roomId = decodeURIComponent(roomMatch[1]);
    if (!isValidId(roomId)) {
      return json({ error: "invalid_room" }, { status: 400, headers: corsHeaders });
    }
    const allowed = await canAccessRoom(env, auth, roomId);
    if (!allowed) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }
    const limitRaw = Number(url.searchParams.get("limit"));
    const result = await listRoomThreads(env, {
      projectId: auth.projectId,
      roomId,
      parent: url.searchParams.has("parent") ? url.searchParams.get("parent") : "",
      root: url.searchParams.get("root"),
      cursor: url.searchParams.get("cursor"),
      limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
    });
    if (!result.ok) {
      return json({ error: result.error }, { status: 400, headers: corsHeaders });
    }
    return json(
      {
        threads: result.threads,
        hasMore: result.hasMore,
        nextCursor: result.nextCursor,
      },
      { status: 200, headers: corsHeaders },
    );
  }

  const limitRaw = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(limitRaw) ? limitRaw : undefined;
  const unreadOnly =
    url.searchParams.get("unread") === "1" ||
    url.searchParams.get("filter") === "unread";

  const result = await listUserThreads(env, {
    projectId: auth.projectId,
    userId: auth.userId,
    roles: auth.roles,
    limit,
    unreadOnly,
  });

  return json(result, { status: 200, headers: corsHeaders });
}
