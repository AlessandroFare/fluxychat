/**
 * Public channel access (Pusher-style): any authenticated project member may subscribe.
 */

/**
 * @param {import("@cloudflare/workers-types").D1Database} db
 * @param {string} projectId
 * @param {string} roomId
 * @returns {Promise<boolean>}
 */
export async function isPublicRoomInProject(db, projectId, roomId) {
  const row = await db
    .prepare(
      "SELECT id FROM rooms WHERE id = ? AND project_id = ? AND type = 'public' LIMIT 1",
    )
    .bind(roomId, projectId)
    .first();
  return !!row?.id;
}

/**
 * Lazy-join public room on first WS/REST access (idempotent).
 * @param {import("@cloudflare/workers-types").Env} env
 * @param {string} projectId
 * @param {string} roomId
 * @param {string} userId
 * @param {string} [memberRole]
 */
export async function ensurePublicRoomMembership(
  env,
  projectId,
  roomId,
  userId,
  memberRole = "member",
) {
  if (!env?.DB || !projectId || !roomId || !userId) return;
  const isPublic = await isPublicRoomInProject(env.DB, projectId, roomId);
  if (!isPublic) return;

  const existing = await env.DB.prepare(
    "SELECT 1 AS ok FROM room_members WHERE room_id = ? AND user_id = ? LIMIT 1",
  )
    .bind(roomId, userId)
    .first();
  if (existing?.ok) return;

  const role = memberRole === "guest" ? "guest" : "member";
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO room_members (room_id, user_id, role, joined_at)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(roomId, userId, role, now)
    .run();
}
