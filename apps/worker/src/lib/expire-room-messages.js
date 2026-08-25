import { scheduleDoAlarmJob } from "./do-alarm-scheduler.js";

const EXPIRED_CONTENT = "[expired]";

/**
 * Soft-delete messages past expires_at and return rows for broadcast.
 *
 * @param {import("@cloudflare/workers-types").D1Database} db
 * @param {{ projectId: string, roomId: string, limit?: number }} scope
 * @returns {Promise<Array<{ id: number, userId: string, expiredAt: string }>>}
 */
export async function findAndExpireDueMessages(db, { projectId, roomId, limit = 50 }) {
  const now = new Date().toISOString();
  const rows = await db
    .prepare(
      `SELECT id, user_id FROM messages
       WHERE project_id = ? AND room_id = ? AND expires_at IS NOT NULL
         AND expires_at <= ? AND deleted_at IS NULL
       ORDER BY expires_at ASC
       LIMIT ?`,
    )
    .bind(projectId, roomId, now, limit)
    .all();

  const expired = [];
  for (const row of rows.results || []) {
    const messageId = Number(row.id);
    if (!Number.isFinite(messageId)) continue;
    await db
      .prepare(
        `UPDATE messages SET deleted_at = ?, content = ? WHERE id = ? AND project_id = ? AND room_id = ?`,
      )
      .bind(now, EXPIRED_CONTENT, messageId, projectId, roomId)
      .run();
    expired.push({
      id: messageId,
      userId: String(row.user_id ?? ""),
      expiredAt: now,
    });
  }
  return expired;
}

/**
 * @param {DurableObjectState["storage"]} storage
 * @param {import("@cloudflare/workers-types").D1Database} db
 * @param {{ projectId: string, roomId: string }} scope
 */
export async function scheduleRoomMessageExpiryAlarm(storage, db, { projectId, roomId }) {
  if (typeof storage?.setAlarm !== "function") return;
  const nowIso = new Date().toISOString();
  const row = await db
    .prepare(
      `SELECT MIN(expires_at) as nextAt FROM messages
       WHERE project_id = ? AND room_id = ? AND expires_at IS NOT NULL
         AND expires_at > ? AND deleted_at IS NULL`,
    )
    .bind(projectId, roomId, nowIso)
    .first();

  const nextAt = row?.nextAt ? Date.parse(String(row.nextAt)) : NaN;
  if (!Number.isFinite(nextAt)) {
    const overdue = await db
      .prepare(
        `SELECT 1 FROM messages
         WHERE project_id = ? AND room_id = ? AND expires_at IS NOT NULL
           AND expires_at <= ? AND deleted_at IS NULL LIMIT 1`,
      )
      .bind(projectId, roomId, nowIso)
      .first();
    if (!overdue) return;
    await scheduleDoAlarmJob(storage, "message-expiry", Date.now() + 1_000, "message-expiry");
    return;
  }

  await scheduleDoAlarmJob(storage, "message-expiry", nextAt, "message-expiry");
}
