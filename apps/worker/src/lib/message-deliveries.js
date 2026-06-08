/**
 * Per-recipient delivery receipts (Sendbird-style, P10-SB4).
 */

/**
 * @param {*} env
 * @param {{ messageId: number, userId: string, status?: string }} row
 */
export async function upsertMessageDelivery(env, { messageId, userId, status = "delivered" }) {
  if (!env?.DB || !messageId || !userId) return;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO message_deliveries (message_id, user_id, status, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(message_id, user_id) DO UPDATE SET
       status = excluded.status,
       updated_at = excluded.updated_at`,
  )
    .bind(messageId, userId, status, now)
    .run();
}

/**
 * @param {*} env
 * @param {number} messageId
 */
export async function listMessageDeliveries(env, messageId) {
  const rows = await env.DB.prepare(
    `SELECT user_id, status, updated_at FROM message_deliveries
     WHERE message_id = ? ORDER BY updated_at ASC`,
  )
    .bind(messageId)
    .all();
  return (rows.results || []).map((r) => ({
    userId: r.user_id,
    status: r.status,
    updatedAt: r.updated_at,
  }));
}

/**
 * @param {*} env
 * @param {number} messageId
 */
export async function countMessageDeliveries(env, messageId) {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM message_deliveries WHERE message_id = ?`,
  )
    .bind(messageId)
    .first();
  return Number(row?.c) || 0;
}
