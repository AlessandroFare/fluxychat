/**
 * @param {import("@cloudflare/workers-types").D1Database} db
 * @param {{ projectId: string, roomId: string, userId: string }} scope
 * @returns {Promise<{ unreadCount: number, lastReadMessageId: number, firstUnreadMessageId: number | null }>}
 */
export async function getRoomCatchUpForUser(db, { projectId, roomId, userId }) {
  const lastRow = await db
    .prepare(
      "SELECT MAX(message_id) as lastRead FROM read_receipts WHERE project_id = ? AND room_id = ? AND user_id = ?",
    )
    .bind(projectId, roomId, userId)
    .first();
  const lastReadMessageId = Number(lastRow?.lastRead) || 0;

  const cntRow = await db
    .prepare(
      "SELECT COUNT(*) as c FROM messages WHERE project_id = ? AND room_id = ? AND id > ? AND deleted_at IS NULL",
    )
    .bind(projectId, roomId, lastReadMessageId)
    .first();
  const unreadCount = Number(cntRow?.c) || 0;

  let firstUnreadMessageId = null;
  if (unreadCount > 0) {
    const firstRow = await db
      .prepare(
        "SELECT MIN(id) as firstId FROM messages WHERE project_id = ? AND room_id = ? AND id > ? AND deleted_at IS NULL",
      )
      .bind(projectId, roomId, lastReadMessageId)
      .first();
    const id = Number(firstRow?.firstId);
    if (Number.isFinite(id) && id > 0) firstUnreadMessageId = id;
  }

  return { unreadCount, lastReadMessageId, firstUnreadMessageId };
}
