import { pickRouteDeps } from "./route-http-deps.js";
import { canAccessRoom } from "../lib/room-access.js";
import { buildRoomCartography, getOrBuildRoomCartography } from "../lib/chat-cartography.js";

export async function dispatchCartographyRoutes(request, url, h) {
  const path = url.pathname;
  const roomMatch = path.match(/^\/rooms\/([^/]+)\/cartography$/);
  if (!roomMatch) return null;

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

  const roomId = decodeURIComponent(roomMatch[1]);
  const allowed = await canAccessRoom(env, auth, roomId);
  if (!allowed) return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

  try {
    if (request.method === "GET") {
      const rebuild = url.searchParams.get("rebuild") === "1";
      const result = rebuild
        ? await getOrBuildRoomCartography(env, {
            projectId: auth.projectId,
            roomId,
            rebuild: true,
          })
        : await getOrBuildRoomCartography(env, { projectId: auth.projectId, roomId });
      if (!result.ok) {
        const status = result.error === "forbidden" ? 403 : 404;
        return json(result, { status, headers: corsHeaders });
      }
      return json(result, { headers: corsHeaders });
    }

    if (request.method === "POST") {
      const result = await buildRoomCartography(env, { projectId: auth.projectId, roomId });
      if (!result.ok) {
        return json(result, { status: 400, headers: corsHeaders });
      }
      return json(result, { status: 201, headers: corsHeaders });
    }
  } catch (err) {
    logError("cartography.route_failed", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }

  return null;
}
