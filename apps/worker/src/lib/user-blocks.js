/**
 * Global user block list (Sendbird-style, P10-SB5).
 */

/**
 * @param {*} env
 * @param {string} projectId
 * @param {string} blockerUserId
 * @param {string} blockedUserId
 */
export async function blockUser(env, projectId, blockerUserId, blockedUserId) {
  if (!projectId || !blockerUserId || !blockedUserId) {
    return { ok: false, error: "invalid_ids" };
  }
  if (blockerUserId === blockedUserId) {
    return { ok: false, error: "cannot_block_self" };
  }
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO user_blocks (project_id, blocker_user_id, blocked_user_id, created_at)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(projectId, blockerUserId, blockedUserId, now)
    .run();
  return { ok: true, blockerUserId, blockedUserId };
}

/**
 * @param {*} env
 * @param {string} projectId
 * @param {string} blockerUserId
 * @param {string} blockedUserId
 */
export async function unblockUser(env, projectId, blockerUserId, blockedUserId) {
  await env.DB.prepare(
    `DELETE FROM user_blocks
     WHERE project_id = ? AND blocker_user_id = ? AND blocked_user_id = ?`,
  )
    .bind(projectId, blockerUserId, blockedUserId)
    .run();
  return { ok: true };
}

/**
 * @param {*} env
 * @param {string} projectId
 * @param {string} blockerUserId
 */
export async function listBlockedUsers(env, projectId, blockerUserId) {
  const rows = await env.DB.prepare(
    `SELECT blocked_user_id, created_at FROM user_blocks
     WHERE project_id = ? AND blocker_user_id = ?
     ORDER BY created_at DESC`,
  )
    .bind(projectId, blockerUserId)
    .all();
  return (rows.results || []).map((r) => ({
    userId: r.blocked_user_id,
    blockedAt: r.created_at,
  }));
}

/**
 * True if either user has blocked the other (symmetric enforcement).
 * @param {*} env
 * @param {string} projectId
 * @param {string} userA
 * @param {string} userB
 */
export async function isBlockedBetween(env, projectId, userA, userB) {
  if (!projectId || !userA || !userB || userA === userB) return false;
  const row = await env.DB.prepare(
    `SELECT 1 AS ok FROM user_blocks
     WHERE project_id = ?
       AND (
         (blocker_user_id = ? AND blocked_user_id = ?)
         OR (blocker_user_id = ? AND blocked_user_id = ?)
       )
     LIMIT 1`,
  )
    .bind(projectId, userA, userB, userB, userA)
    .first();
  return !!row?.ok;
}

/**
 * Filter user ids removing anyone blocked with actor (either direction).
 * @param {*} env
 * @param {string} projectId
 * @param {string} actorUserId
 * @param {string[]} userIds
 */
export async function filterBlockedUserIds(env, projectId, actorUserId, userIds) {
  if (!userIds.length) return [];
  const placeholders = userIds.map(() => "?").join(",");
  const rows = await env.DB.prepare(
    `SELECT blocked_user_id AS uid FROM user_blocks
     WHERE project_id = ? AND blocker_user_id = ? AND blocked_user_id IN (${placeholders})
     UNION
     SELECT blocker_user_id AS uid FROM user_blocks
     WHERE project_id = ? AND blocked_user_id = ? AND blocker_user_id IN (${placeholders})`,
  )
    .bind(projectId, actorUserId, ...userIds, projectId, actorUserId, ...userIds)
    .all();
  const blocked = new Set((rows.results || []).map((r) => r.uid));
  return userIds.filter((id) => !blocked.has(id));
}
