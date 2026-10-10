import { pickRouteDeps } from "./route-http-deps.js";
import { canAccessRoom } from "../lib/room-access.js";
import {
  parseBreakoutInput,
  createBreakout,
  listBreakouts,
  closeBreakout,
  joinBreakout,
  moveBreakoutUser,
  endAllBreakouts,
  setBreakoutTime,
  broadcastToBreakouts,
} from "../lib/breakout-rooms.js";
import {
  activateRoomTimer,
  getRoomTimer,
  resetRoomTimer,
  setRoomTimerMode,
  setRoomTimerTime,
  startRoomTimer,
  stopRoomTimer,
} from "../lib/edu-timer.js";

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
  const endAllMatch = url.pathname.match(/^\/rooms\/([^/]+)\/breakouts\/end-all$/);
  const broadcastMatch = url.pathname.match(/^\/rooms\/([^/]+)\/breakouts\/broadcast$/);
  const joinMatch = url.pathname.match(/^\/rooms\/([^/]+)\/breakouts\/([^/]+)\/join$/);
  const moveMatch = url.pathname.match(/^\/rooms\/([^/]+)\/breakouts\/([^/]+)\/move$/);
  const timeMatch = url.pathname.match(/^\/rooms\/([^/]+)\/breakouts\/([^/]+)\/time$/);
  const closeMatch = url.pathname.match(/^\/rooms\/([^/]+)\/breakouts\/([^/]+)$/);
  const timerGetMatch = url.pathname.match(/^\/rooms\/([^/]+)\/timer$/);
  const timerActionMatch = url.pathname.match(/^\/rooms\/([^/]+)\/timer\/(activate|start|stop|reset|deactivate|time|mode)$/);

  if (!listCreateMatch && !endAllMatch && !broadcastMatch && !joinMatch && !moveMatch && !timeMatch && !closeMatch && !timerGetMatch && !timerActionMatch) {
    return null;
  }

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  try {
    const timerRoomId = timerGetMatch?.[1] || timerActionMatch?.[1];
    if (timerRoomId && (timerGetMatch || timerActionMatch)) {
      const canAccess = await canAccessRoom(env, auth, timerRoomId);
      if (!canAccess) return json({ error: "forbidden" }, { status: 403 });
      const base = { projectId: auth.projectId, roomId: timerRoomId, userId: auth.userId };
      if (timerGetMatch && request.method === "GET") {
        return json(await getRoomTimer(env, base), { headers: corsHeaders });
      }
      if (timerActionMatch && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const action = timerActionMatch[2];
        const handlers = {
          activate: activateRoomTimer,
          start: startRoomTimer,
          stop: stopRoomTimer,
          reset: resetRoomTimer,
          deactivate: resetRoomTimer,
          time: setRoomTimerTime,
          mode: setRoomTimerMode,
        };
        const result = await handlers[action](env, { ...base, ...body });
        return json(result, { status: result.ok ? 200 : 400, headers: corsHeaders });
      }
      return json({ error: "method_not_allowed" }, { status: 405, headers: corsHeaders });
    }

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

    if (endAllMatch && request.method === "POST") {
      const roomId = endAllMatch[1];
      if (!(await canAccessRoom(env, auth, roomId))) return json({ error: "forbidden" }, { status: 403 });
      const result = await endAllBreakouts(env, {
        projectId: auth.projectId,
        parentRoomId: roomId,
        closedBy: auth.userId,
      });
      return json(result, { headers: corsHeaders });
    }

    if (broadcastMatch && request.method === "POST") {
      const roomId = broadcastMatch[1];
      if (!(await canAccessRoom(env, auth, roomId))) return json({ error: "forbidden" }, { status: 403 });
      const body = await request.json().catch(() => null);
      const result = await broadcastToBreakouts(env, {
        projectId: auth.projectId,
        parentRoomId: roomId,
        userId: auth.userId,
        content: body?.content,
      });
      if (!result.ok) return json(result, { status: 400, headers: corsHeaders });
      return json(result, { headers: corsHeaders });
    }

    if (joinMatch && request.method === "POST") {
      const roomId = joinMatch[1];
      const breakoutId = joinMatch[2];
      if (!(await canAccessRoom(env, auth, roomId))) return json({ error: "forbidden" }, { status: 403 });
      const result = await joinBreakout(env, {
        projectId: auth.projectId,
        breakoutId,
        userId: auth.userId,
      });
      if (!result.ok) return json(result, { status: result.status || 400, headers: corsHeaders });
      return json(result, { headers: corsHeaders });
    }

    if (moveMatch && request.method === "POST") {
      const roomId = moveMatch[1];
      const breakoutId = moveMatch[2];
      if (!(await canAccessRoom(env, auth, roomId))) return json({ error: "forbidden" }, { status: 403 });
      const body = await request.json().catch(() => null);
      const userId = String(body?.userId || "").trim() || auth.userId;
      const result = await moveBreakoutUser(env, {
        projectId: auth.projectId,
        breakoutId,
        userId,
      });
      if (!result.ok) return json(result, { status: result.status || 400, headers: corsHeaders });
      return json(result, { headers: corsHeaders });
    }

    if (timeMatch && request.method === "POST") {
      const roomId = timeMatch[1];
      const breakoutId = timeMatch[2];
      if (!(await canAccessRoom(env, auth, roomId))) return json({ error: "forbidden" }, { status: 403 });
      const body = await request.json().catch(() => null);
      const result = await setBreakoutTime(env, {
        projectId: auth.projectId,
        breakoutId,
        userId: auth.userId,
        minutes: body?.minutes,
      });
      if (!result.ok) return json(result, { status: result.status || 400, headers: corsHeaders });
      return json(result, { headers: corsHeaders });
    }

    /* ── POST /rooms/:id/breakouts/:breakoutId ── close */
    if (closeMatch && request.method === "POST") {
      const roomId = closeMatch[1];
      const breakoutId = closeMatch[2];
      const canAccess = await canAccessRoom(env, auth, roomId);
      if (!canAccess) return json({ error: "forbidden" }, { status: 403 });

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
