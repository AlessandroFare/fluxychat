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

/**
 * Stream `channel.markUnread({ message_id })`: that message and later are unread.
 * Watermark becomes the previous message id (or 0).
 */
export async function markUnreadFromMessage(db, { projectId, roomId, userId, messageId }) {
  const id = Math.floor(Number(messageId));
  if (!Number.isFinite(id) || id < 1) return { ok: false, error: "messageId required" };

  await db
    .prepare(
      "DELETE FROM read_receipts WHERE project_id = ? AND room_id = ? AND user_id = ? AND message_id >= ?",
    )
    .bind(projectId, roomId, userId, id)
    .run();

  const previous = id - 1;
  if (previous >= 1) {
    const now = new Date().toISOString();
    await db
      .prepare(
        "INSERT OR IGNORE INTO read_receipts (project_id, room_id, user_id, message_id, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(projectId, roomId, userId, previous, now)
      .run();
  }

  const catchUp = await getRoomCatchUpForUser(db, { projectId, roomId, userId });
  return { ok: true, ...catchUp };
}
