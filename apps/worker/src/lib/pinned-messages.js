/**
 * P17-K: Pinned Knowledge + Highlights
 *
 * Multi-pin system per room with categories (decision, info, checklist, important).
 * Extends the existing single-room pin (rooms.pinned_message_id) with a proper
 * pins table supporting multiple pins per room, categories, sort order, and
 * integration with knowledge graph entity search.
 *
 * Architecture:
 * - room_pins table (D1) with unique(room_id, message_id)
 * - Categories: decision, info, checklist, important
 * - Max pins per room configurable via env (default 20)
 * - Pinned items searchable via P12-E FTS5 + P17-I search
 */

import { logInfo } from "./worker-log.js";

const VALID_CATEGORIES = ["decision", "info", "checklist", "important"];
const DEFAULT_MAX_PINS = 20;

/**
 * Pin a message to a room.
 */
export async function pinMessage(env, input) {
  const { projectId, roomId, messageId, pinnedBy, category } = input;
  if (!messageId) return { ok: false, error: "message_id_required" };
  if (category && !VALID_CATEGORIES.includes(category)) {
    return { ok: false, error: "invalid_category" };
  }

  const maxPins = Math.max(Number(env.PIN_MAX_PER_ROOM) || DEFAULT_MAX_PINS, 1);

  // Check existing pin count
  const countRow = await env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM room_pins WHERE room_id = ? AND project_id = ?"
  )
    .bind(roomId, projectId)
    .first();
  const currentCount = countRow?.cnt || 0;

  // Check if already pinned
  const existing = await env.DB.prepare(
    "SELECT id FROM room_pins WHERE room_id = ? AND message_id = ?"
  )
    .bind(roomId, messageId)
    .first();

  if (existing) {
    return { ok: false, error: "already_pinned" };
  }

  if (currentCount >= maxPins) {
    return { ok: false, error: "max_pins_reached", maxPins };
  }

  // Verify message exists
  const msg = await env.DB.prepare(
    "SELECT id FROM messages WHERE id = ? AND project_id = ? AND room_id = ? AND deleted_at IS NULL"
  )
    .bind(messageId, projectId, roomId)
    .first();

  if (!msg) return { ok: false, error: "message_not_found" };

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const sortOrder = currentCount;

  await env.DB.prepare(
    `INSERT INTO room_pins (id, project_id, room_id, message_id, pinned_by, category, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, projectId, roomId, messageId, pinnedBy, category || "important", sortOrder, now)
    .run();

  // Broadcast pin event
  try {
    const stub = env.ROOM.get(env.ROOM.idFromName(roomId));
    await stub.fetch("https://internal/announce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "message_pinned",
        roomId,
        messageId,
        pinnedBy,
        pinnedAt: now,
        category: category || "important",
        pinId: id,
      }),
    });
  } catch {
    /* best effort */
  }

  logInfo("pin.message_pinned", { projectId, roomId, messageId, pinnedBy, category: category || "important" });
  return { ok: true, id, sortOrder };
}

/**
 * Unpin a message from a room.
 */
export async function unpinMessage(env, input) {
  const { projectId, roomId, messageId } = input;
  if (!messageId) return { ok: false, error: "message_id_required" };

  const existing = await env.DB.prepare(
    "SELECT id FROM room_pins WHERE room_id = ? AND message_id = ? AND project_id = ?"
  )
    .bind(roomId, messageId, projectId)
    .first();

  if (!existing) return { ok: false, error: "not_pinned" };

  await env.DB.prepare("DELETE FROM room_pins WHERE id = ?")
    .bind(existing.id)
    .run();

  // Broadcast unpin event
  try {
    const stub = env.ROOM.get(env.ROOM.idFromName(roomId));
    await stub.fetch("https://internal/announce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "message_unpinned",
        roomId,
        messageId,
      }),
    });
  } catch {
    /* best effort */
  }

  return { ok: true };
}

/**
 * List pinned messages for a room.
 */
export async function listPins(env, input) {
  const { projectId, roomId, category, limit } = input;
  const maxResults = Math.min(Math.max(Number(limit) || 50, 1), 100);

  let sql = `
    SELECT rp.*, m.content, m.user_id AS message_user_id, m.created_at AS message_created_at
    FROM room_pins rp
    JOIN messages m ON m.id = rp.message_id AND m.room_id = rp.room_id
    WHERE rp.project_id = ? AND rp.room_id = ?
  `;
  const params = [projectId, roomId];

  if (category && VALID_CATEGORIES.includes(category)) {
    sql += " AND rp.category = ?";
    params.push(category);
  }

  sql += " ORDER BY rp.sort_order ASC, rp.created_at DESC LIMIT ?";
  params.push(maxResults);

  const rows = await env.DB.prepare(sql).bind(...params).all();

  const pins = (rows.results || []).map((r) => ({
    id: r.id,
    messageId: r.message_id,
    pinnedBy: r.pinned_by,
    category: r.category,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    message: {
      content: r.content,
      userId: r.message_user_id,
      createdAt: r.message_created_at,
    },
  }));

  return { ok: true, pins, count: pins.length };
}

/**
 * Get pin stats for a project (admin).
 */
export async function getPinStats(env, input) {
  const { projectId } = input;

  const totalRow = await env.DB.prepare(
    "SELECT COUNT(*) as total FROM room_pins WHERE project_id = ?"
  )
    .bind(projectId)
    .first();

  const categoryRows = await env.DB.prepare(
    "SELECT category, COUNT(*) as cnt FROM room_pins WHERE project_id = ? GROUP BY category"
  )
    .bind(projectId)
    .all();

  const categoryCounts = {};
  for (const r of categoryRows.results || []) {
    categoryCounts[r.category] = r.cnt;
  }

  return {
    ok: true,
    total: totalRow?.total || 0,
    byCategory: categoryCounts,
  };
}
