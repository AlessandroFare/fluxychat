/**
 * Saved messages — Slack "Save for later" / Mattermost saved posts.
 * Per-user, per-message bookmark; the row survives message soft-deletes but
 * list reads filter deleted messages out.
 */

function nowIso() {
  return new Date().toISOString();
}

export async function saveMessage(env, { projectId, userId, messageId, roomId }) {
  const id = Number(messageId);
  if (!projectId || !userId || !roomId || !Number.isFinite(id) || id < 1) {
    return { ok: false, error: "invalid_saved_message" };
  }
  await env.DB.prepare(
    `INSERT OR IGNORE INTO saved_messages (project_id, user_id, message_id, room_id, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(projectId, userId, id, roomId, nowIso())
    .run();
  return { ok: true, saved: true, messageId: id };
}

export async function unsaveMessage(env, { projectId, userId, messageId }) {
  const id = Number(messageId);
  if (!projectId || !userId || !Number.isFinite(id) || id < 1) {
    return { ok: false, error: "invalid_saved_message" };
  }
  await env.DB.prepare(
    `DELETE FROM saved_messages WHERE project_id = ? AND user_id = ? AND message_id = ?`,
  )
    .bind(projectId, userId, id)
    .run();
  return { ok: true, saved: false, messageId: id };
}

export async function listSavedMessages(env, { projectId, userId, limit = 50 }) {
  if (!projectId || !userId) return { items: [] };
  const capped = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const rows = await env.DB.prepare(
    `SELECT s.message_id, s.room_id, s.created_at AS saved_at,
            m.content, m.user_id AS author_id, m.created_at, m.deleted_at,
            r.name AS room_name
       FROM saved_messages s
       JOIN messages m ON m.id = s.message_id
       LEFT JOIN rooms r ON r.id = s.room_id AND r.project_id = s.project_id
      WHERE s.project_id = ? AND s.user_id = ?
      ORDER BY s.created_at DESC
      LIMIT ?`,
  )
    .bind(projectId, userId, capped)
    .all();
  const items = (rows.results || [])
    .filter((row) => !row.deleted_at)
    .map((row) => ({
      messageId: Number(row.message_id),
      roomId: row.room_id,
      roomName: row.room_name || row.room_id,
      authorId: row.author_id,
      preview: String(row.content || "").replace(/\s+/g, " ").trim().slice(0, 160),
      createdAt: row.created_at,
      savedAt: row.saved_at,
    }));
  return { items };
}
