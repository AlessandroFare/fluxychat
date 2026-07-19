const BREAKOUT_NAME_MAX = 100;
const BREAKOUT_AUTO_CLOSE_HOURS = 24;

/**
 * Generate a short unique ID for a breakout room.
 */
function generateBreakoutId() {
  return "brk_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

/**
 * Validate breakout create input.
 * @param {unknown} body
 */
export function parseBreakoutInput(body) {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "request body required" };
  }
  const name = String(body.name ?? "").trim();
  if (!name || name.length > BREAKOUT_NAME_MAX) {
    return { ok: false, error: `name required (max ${BREAKOUT_NAME_MAX} chars)` };
  }
  return { ok: true, name };
}

/**
 * Create a breakout room.
 * @param {*} env
 * @param {{ projectId: string, parentRoomId: string, name: string, createdBy: string }} input
 */
export async function createBreakout(env, input) {
  const id = generateBreakoutId();
  const now = new Date().toISOString();
  const autoCloseAt = new Date(Date.now() + BREAKOUT_AUTO_CLOSE_HOURS * 60 * 60 * 1000).toISOString();

  await env.DB.prepare(
    `INSERT INTO breakout_rooms (id, project_id, parent_room_id, name, created_by, auto_close_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, input.projectId, input.parentRoomId, input.name, input.createdBy, autoCloseAt, now)
    .run();

  return {
    ok: true,
    breakout: { id, name: input.name, parentRoomId: input.parentRoomId, status: "active", autoCloseAt, createdAt: now },
  };
}

/**
 * List active breakouts for a room.
 * @param {*} env
 * @param {{ projectId: string, parentRoomId: string }} input
 */
export async function listBreakouts(env, input) {
  const rows = await env.DB.prepare(
    `SELECT id, name, created_by, member_count, status, auto_close_at, created_at
     FROM breakout_rooms
     WHERE project_id = ? AND parent_room_id = ? AND status = 'active'
     ORDER BY created_at DESC LIMIT 50`,
  )
    .bind(input.projectId, input.parentRoomId)
    .all();

  return {
    ok: true,
    breakouts: (rows.results || []).map((r) => ({
      id: r.id,
      name: r.name,
      createdBy: r.created_by,
      memberCount: r.member_count,
      status: r.status,
      autoCloseAt: r.auto_close_at,
      createdAt: r.created_at,
    })),
  };
}

/**
 * Close a breakout room.
 * @param {*} env
 * @param {{ projectId: string, breakoutId: string, closedBy: string }} input
 */
export async function closeBreakout(env, input) {
  const row = await env.DB.prepare(
    `SELECT id, status FROM breakout_rooms WHERE id = ? AND project_id = ? LIMIT 1`,
  )
    .bind(input.breakoutId, input.projectId)
    .first();

  if (!row) return { ok: false, error: "breakout_not_found", status: 404 };
  if (row.status !== "active") return { ok: false, error: "already_closed", status: 400 };

  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE breakout_rooms SET status = 'closed', closed_at = ?, closed_by = ? WHERE id = ? AND project_id = ?`,
  )
    .bind(now, input.closedBy, input.breakoutId, input.projectId)
    .run();

  return { ok: true, closedAt: now };
}
