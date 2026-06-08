import { validateMessageContent } from "./message-validation.js";
import { runInboundMessageMiddleware } from "./message-middleware.js";

/**
 * @param {import("@cloudflare/workers-types").D1Database} db
 * @param {{ projectId: string, roomId: string, limit?: number }} scope
 */
export async function listDueScheduledMessages(db, { projectId, roomId, limit = 20 }) {
  const now = new Date().toISOString();
  const rows = await db
    .prepare(
      `SELECT id, user_id, content, send_at, parent_id
       FROM scheduled_messages
       WHERE project_id = ? AND room_id = ? AND status = 'pending' AND send_at <= ?
       ORDER BY send_at ASC
       LIMIT ?`,
    )
    .bind(projectId, roomId, now, limit)
    .all();
  return rows.results || [];
}

/**
 * Deliver due scheduled messages for a room (called from Room DO alarm).
 *
 * Race-safety: each schedule is atomically claimed via a conditional
 * `UPDATE … WHERE status = 'pending'` before the message is inserted. If the
 * alarm fires twice in quick succession (e.g. DO hibernation / retry) only
 * one process will see `meta.changes > 0` for a given row, so duplicate
 * messages cannot be created. For cross-shard / cross-process "only one
 * instance runs the digest" patterns, use `withLock` from `do-lock.js` at
 * the caller level.
 *
 * @param {object} env
 * @param {{ projectId: string, roomId: string, broadcast: (payload: object) => void }} ctx
 */
export async function processDueScheduledMessages(env, { projectId, roomId, broadcast }) {
  const due = await listDueScheduledMessages(env.DB, { projectId, roomId });
  if (!due.length) return 0;

  let sent = 0;
  for (const row of due) {
    const scheduleId = Number(row.id);
    const middlewareResult = await runInboundMessageMiddleware(env, {
      content: row.content,
    });
    if (!middlewareResult.ok) {
      await env.DB.prepare(
        `UPDATE scheduled_messages SET status = 'failed', cancelled_at = ? WHERE id = ?`,
      )
        .bind(new Date().toISOString(), scheduleId)
        .run();
      continue;
    }
    const contentValidation = validateMessageContent(middlewareResult.content);
    if (!contentValidation.valid) {
      await env.DB.prepare(
        `UPDATE scheduled_messages SET status = 'failed', cancelled_at = ? WHERE id = ?`,
      )
        .bind(new Date().toISOString(), scheduleId)
        .run();
      continue;
    }

    // Atomic claim: only the caller that sees changes > 0 proceeds to insert
    // the message. All other concurrent callers skip this row.
    const claim = await env.DB.prepare(
      `UPDATE scheduled_messages SET status = 'dispatched', dispatched_at = ?
       WHERE id = ? AND status = 'pending'`,
    )
      .bind(new Date().toISOString(), scheduleId)
      .run();
    if (Number(claim?.meta?.changes ?? 0) === 0) {
      // Already claimed by a concurrent dispatch (DO re-fire, shard overlap).
      continue;
    }

    const createdAt = new Date().toISOString();
    const insert = await env.DB.prepare(
      `INSERT INTO messages (project_id, room_id, user_id, content, created_at, parent_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        projectId,
        roomId,
        row.user_id,
        contentValidation.content,
        createdAt,
        row.parent_id ? Number(row.parent_id) || null : null,
      )
      .run();
    const messageId = insert.meta.last_row_id;
    await env.DB.prepare(
      `UPDATE scheduled_messages SET status = 'sent', sent_message_id = ? WHERE id = ?`,
    )
      .bind(messageId, scheduleId)
      .run();

    broadcast({
      type: "message",
      id: messageId,
      roomId,
      userId: row.user_id,
      senderId: row.user_id,
      content: contentValidation.content,
      createdAt,
      parentId: row.parent_id ? Number(row.parent_id) || null : null,
      scheduled: true,
    });
    sent += 1;
  }
  return sent;
}
