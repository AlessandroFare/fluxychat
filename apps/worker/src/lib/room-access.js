import { isGuestOnlyAuth } from "./guest-auth.js";

export async function isRoomMember(env, projectId, roomId, userId) {
  const row = await env.DB.prepare(
    "SELECT 1 as ok FROM room_members WHERE room_id = ? AND user_id = ? LIMIT 1"
  )
    .bind(roomId, userId)
    .first();
  if (row?.ok) return true;

  const roomRow = await env.DB.prepare(
    "SELECT id, type FROM rooms WHERE id = ? AND project_id = ? LIMIT 1"
  )
    .bind(roomId, projectId)
    .first();
  if (!roomRow) return false;
  // Public channels: any authenticated project member may access (P9-19).
  if (roomRow.type === "public") return true;

  return false;
}

function canBypassRoomMembership(roles) {
  if (!Array.isArray(roles)) return false;
  return roles.some((r) => ["owner", "admin", "moderator", "bot"].includes(r));
}

/**
 * Room access including guest-only tokens scoped to public rooms (P10-SB6).
 * @param {*} env
 * @param {{ projectId?: string, userId?: string, roles?: string[], roomId?: string } | null} auth
 * @param {string} roomId
 */
export async function canAccessRoom(env, auth, roomId) {
  if (!auth?.projectId || !auth?.userId || !roomId) return false;

  if (isGuestOnlyAuth(auth)) {
    const room = await env.DB.prepare(
      "SELECT id, type FROM rooms WHERE id = ? AND project_id = ? LIMIT 1",
    )
      .bind(roomId, auth.projectId)
      .first();
    if (room?.type !== "public") return false;
    if (auth.roomId && auth.roomId !== roomId) return false;
    return true;
  }

  if (canBypassRoomMembership(auth.roles)) {
    const room = await env.DB.prepare(
      "SELECT id FROM rooms WHERE id = ? AND project_id = ? LIMIT 1",
    )
      .bind(roomId, auth.projectId)
      .first();
    return !!room?.id;
  }

  return isRoomMember(env, auth.projectId, roomId, auth.userId);
}
