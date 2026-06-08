import { verifyJwtAndGetContext } from "../lib/jwt-request.js";
import { logError } from "../lib/worker-log.js";
import { deliverWebhooks } from "../lib/webhook-delivery.js";
import { pickRouteDeps } from "./route-http-deps.js";

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;
const MAX_ROOM_FANOUT = 100;

function userDoId(env, projectId, userId) {
  return env.USER.idFromName(`${projectId}__${userId}`);
}

function canTargetUser(auth, targetUserId) {
  if (auth.userId === targetUserId) return true;
  const roles = Array.isArray(auth.roles) ? auth.roles : [];
  return roles.includes("admin") || roles.includes("owner");
}

function isAdminOnly(auth) {
  const roles = Array.isArray(auth.roles) ? auth.roles : [];
  return roles.includes("admin") || roles.includes("owner");
}

const MAX_ROOM_TERMINATE = 100;

/**
 * User channel routes: events, terminate connections.
 * @returns {Promise<Response|null>}
 */
export async function dispatchUsersEventsRoutes(request, url, h) {
  const connMatch = url.pathname.match(/^\/users\/([^/]+)\/connections$/);
  if (connMatch && request.method === "DELETE") {
    const targetUserId = decodeURIComponent(connMatch[1]);
    if (!VALID_ID_REGEX.test(targetUserId)) {
      const { json } = pickRouteDeps(h, ["json"]);
      return json({ error: "invalid_user_id" }, 400);
    }

    const { env, json, writeAuditEvent } = pickRouteDeps(h, [
      "env",
      "json",
      "writeAuditEvent",
    ]);

    const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
    if (!auth) {
      return json({ error: "unauthorized" }, 401);
    }
    if (!isAdminOnly(auth) && auth.userId !== targetUserId) {
      return json({ error: "forbidden" }, 403);
    }

    let userClosed = 0;
    let roomsClosed = 0;
    try {
      const stub = env.USER.get(userDoId(env, auth.projectId, targetUserId));
      const res = await stub.fetch("https://internal/terminate", {
        method: "POST",
        body: JSON.stringify({ reason: "admin_terminate" }),
      });
      if (res.ok) {
        const payload = await res.json();
        userClosed = Number(payload.closed) || 0;
      }
    } catch (err) {
      logError("users.terminate_user_do_failed", err, { targetUserId });
    }

    try {
      const rows = await env.DB.prepare(
        `SELECT rm.room_id AS room_id
         FROM room_members rm
         INNER JOIN rooms r ON r.id = rm.room_id
         WHERE r.project_id = ? AND rm.user_id = ?
         LIMIT ?`,
      )
        .bind(auth.projectId, targetUserId, MAX_ROOM_TERMINATE)
        .all();

      const roomIds = (rows.results || []).map((r) => r.room_id).filter(Boolean);
      await Promise.all(
        roomIds.map(async (roomId) => {
          try {
            const stub = env.ROOM.get(env.ROOM.idFromName(roomId));
            const res = await stub.fetch("https://internal/terminate-user", {
              method: "POST",
              body: JSON.stringify({ userId: targetUserId, reason: "admin_terminate" }),
            });
            if (res.ok) {
              const payload = await res.json();
              roomsClosed += Number(payload.closed) || 0;
            }
          } catch (err) {
            logError("users.terminate_room_failed", err, { roomId, targetUserId });
          }
        }),
      );
    } catch (err) {
      logError("users.terminate_room_list_failed", err, { targetUserId });
    }

    void writeAuditEvent(env, {
      projectId: auth.projectId,
      action: "user.connections_terminated",
      actorUserId: auth.userId,
      targetType: "user",
      targetId: targetUserId,
      metadata: { userChannelClosed: userClosed, roomSocketsClosed: roomsClosed },
    }).catch((err) => logError("audit.terminate_connections_failed", err));

    return json({
      ok: true,
      userId: targetUserId,
      closed: {
        userChannel: userClosed,
        roomSockets: roomsClosed,
      },
    });
  }

  const match = url.pathname.match(/^\/users\/([^/]+)\/events$/);
  if (!match || request.method !== "POST") return null;

  const targetUserId = decodeURIComponent(match[1]);
  if (!VALID_ID_REGEX.test(targetUserId)) {
    const { json } = pickRouteDeps(h, ["json"]);
    return json({ error: "invalid_user_id" }, 400);
  }

  const { env, json } = pickRouteDeps(h, ["env", "json"]);

  const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
  if (!auth) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!canTargetUser(auth, targetUserId)) {
    return json({ error: "forbidden" }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return json({ error: "name_required" }, 400);
  }

  const excludeSocketId =
    typeof body.excludeSocketId === "string" && body.excludeSocketId
      ? body.excludeSocketId
      : typeof body.socket_id === "string" && body.socket_id
        ? body.socket_id
        : null;

  const fanoutRooms = body.fanoutRooms !== false;

  let userDelivered = 0;
  try {
    const stub = env.USER.get(userDoId(env, auth.projectId, targetUserId));
    const res = await stub.fetch("https://internal/deliver", {
      method: "POST",
      body: JSON.stringify({
        name,
        data: body.data ?? {},
        userId: targetUserId,
        excludeSocketId,
      }),
    });
    if (res.ok) {
      const payload = await res.json();
      userDelivered = Number(payload.delivered) || 0;
    }
  } catch (err) {
    logError("users_events.user_do_failed", err, { targetUserId });
  }

  let roomFanout = 0;
  if (fanoutRooms) {
    try {
      const rows = await env.DB.prepare(
        `SELECT rm.room_id AS room_id
         FROM room_members rm
         INNER JOIN rooms r ON r.id = rm.room_id
         WHERE r.project_id = ? AND rm.user_id = ?
         LIMIT ?`,
      )
        .bind(auth.projectId, targetUserId, MAX_ROOM_FANOUT)
        .all();

      const roomIds = (rows.results || []).map((r) => r.room_id).filter(Boolean);
      await Promise.all(
        roomIds.map(async (roomId) => {
          try {
            const stub = env.ROOM.get(env.ROOM.idFromName(roomId));
            const res = await stub.fetch("https://internal/announce", {
              method: "POST",
              body: JSON.stringify({
                type: "user_event",
                roomId,
                userId: targetUserId,
                name,
                data: body.data ?? {},
                recipientUserIds: [targetUserId],
                excludeSocketId,
              }),
            });
            if (res.ok) roomFanout += 1;
          } catch (err) {
            logError("users_events.room_fanout_failed", err, { roomId, targetUserId });
          }
        }),
      );
    } catch (err) {
      logError("users_events.room_list_failed", err, { targetUserId });
    }
  }

  void deliverWebhooks(env, auth.projectId, "user.event", {
    userId: targetUserId,
    name,
    data: body.data ?? {},
    delivered: { userChannel: userDelivered, rooms: roomFanout },
    at: new Date().toISOString(),
  }).catch((err) => logError("webhook.user_event_failed", err, { targetUserId }));

  return json({
    ok: true,
    userId: targetUserId,
    delivered: {
      userChannel: userDelivered,
      rooms: roomFanout,
    },
  });
}
