/**
 * CP-021: Push inbox_updated over the user-channel WebSocket (User DO).
 */

import { logError } from "./worker-log.js";

function userDoId(env, projectId, userId) {
  return env.USER.idFromName(`${projectId}__${userId}`);
}

/**
 * Deliver inbox_updated to a single user's user-channel WS.
 */
export async function notifyInboxUpdated(env, input) {
  const {
    projectId,
    userId,
    roomId,
    roomName,
    kind = "unread",
    unreadCount,
    messageId,
    preview,
    receivedAt,
  } = input;

  if (!env?.USER || !projectId || !userId || !roomId) {
    return { ok: false, delivered: 0 };
  }

  try {
    const stub = env.USER.get(userDoId(env, projectId, userId));
    const res = await stub.fetch("https://internal/deliver", {
      method: "POST",
      body: JSON.stringify({
        name: "inbox_updated",
        userId,
        data: {
          kind,
          roomId,
          roomName: roomName || roomId,
          unreadCount,
          messageId,
          preview,
          receivedAt: receivedAt || new Date().toISOString(),
        },
      }),
    });
    if (!res.ok) return { ok: false, delivered: 0 };
    const payload = await res.json().catch(() => ({}));
    return { ok: true, delivered: Number(payload.delivered) || 0 };
  } catch (err) {
    logError("inbox.push_updated_failed", err, { projectId, userId, roomId });
    return { ok: false, delivered: 0 };
  }
}

/**
 * Fan-out inbox_updated to room members (except optional author).
 */
export async function notifyInboxUpdatedForRoomMembers(env, input) {
  const {
    projectId,
    roomId,
    excludeUserId,
    kind = "unread",
    messageId,
    preview,
    roomName,
  } = input;

  if (!projectId || !roomId) return { notified: 0 };

  let members;
  try {
    const rows = await env.DB.prepare(
      `SELECT rm.user_id, r.name AS room_name
       FROM room_members rm
       INNER JOIN rooms r ON r.id = rm.room_id
       WHERE rm.room_id = ? AND r.project_id = ?`,
    )
      .bind(roomId, projectId)
      .all();
    members = rows.results || [];
  } catch (err) {
    logError("inbox.member_list_failed", err, { projectId, roomId });
    return { notified: 0 };
  }

  let notified = 0;
  const resolvedRoomName = roomName || members[0]?.room_name || roomId;
  const now = new Date().toISOString();

  await Promise.all(
    members.map(async (row) => {
      const userId = row.user_id;
      if (!userId || userId === excludeUserId) return;
      const result = await notifyInboxUpdated(env, {
        projectId,
        userId,
        roomId,
        roomName: resolvedRoomName,
        kind,
        messageId,
        preview,
        receivedAt: now,
      });
      if (result.delivered) notified += 1;
    }),
  );

  return { notified };
}
