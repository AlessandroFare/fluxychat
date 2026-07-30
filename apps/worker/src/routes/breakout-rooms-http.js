import { pickRouteDeps } from "./route-http-deps.js";
import { canAccessRoom } from "../lib/room-access.js";
import {
  parseBreakoutInput,
  createBreakout,
  listBreakouts,
  closeBreakout,
} from "../lib/breakout-rooms.js";

export async function dispatchBreakoutRoomsRoutes(request, url, h) {
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

  const listCreateMatch = url.pathname.match(/^\/rooms\/([^/]+)\/breakouts$/);
  const closeMatch = url.pathname.match(/^\/rooms\/([^/]+)\/breakouts\/([^/]+)$/);

  if (!listCreateMatch && !closeMatch) return null;

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  try {
    /* ── GET /rooms/:id/breakouts ── */
    if (listCreateMatch && request.method === "GET") {
      const roomId = listCreateMatch[1];
      const canAccess = await canAccessRoom(env, auth, roomId);
      if (!canAccess) return json({ error: "forbidden" }, { status: 403 });

      const result = await listBreakouts(env, {
        projectId: auth.projectId,
        parentRoomId: roomId,
      });
      return json(result, { headers: corsHeaders });
    }

    /* ── POST /rooms/:id/breakouts ── */
    if (listCreateMatch && request.method === "POST") {
      const roomId = listCreateMatch[1];
      const canAccess = await canAccessRoom(env, auth, roomId);
      if (!canAccess) return json({ error: "forbidden" }, { status: 403 });

      const body = await request.json().catch(() => null);
      const parsed = parseBreakoutInput(body);
      if (!parsed.ok) return json({ error: parsed.error }, { status: 400 });

      const result = await createBreakout(env, {
        projectId: auth.projectId,
        parentRoomId: roomId,
        name: parsed.name,
        createdBy: auth.userId,
      });

      if (!result.ok) {
        return json(result, { status: 400, headers: corsHeaders });
      }
      return json(result, { status: 201, headers: corsHeaders });
    }

    /* ── POST /rooms/:id/breakouts/:breakoutId/close ── */
    if (closeMatch && request.method === "POST") {
      const roomId = closeMatch[1];
      const breakoutId = closeMatch[2];
      const canAccess = await canAccessRoom(env, auth, roomId);
      if (!canAccess) return json({ error: "forbidden" }, { status: 403 });

      // Only the original creator can close a breakout
      const result = await closeBreakout(env, {
        projectId: auth.projectId,
        breakoutId,
        closedBy: auth.userId,
      });

      if (!result.ok) {
        const status = result.error === "breakout_not_found" ? 404 : 400;
        return json(result, { status, headers: corsHeaders });
      }
      return json(result, { headers: corsHeaders });
    }

    return null;
  } catch (err) {
    logError("breakout.unhandled", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
