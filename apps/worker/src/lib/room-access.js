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
  if (roomRow.type !== "public") return false;

  const membersCount = await env.DB.prepare(
    "SELECT COUNT(*) as c FROM room_members WHERE room_id = ?"
  )
    .bind(roomId)
    .first();
  return Number(membersCount?.c ?? 0) === 0;
}
