import { fanoutServerEvent } from "./message-realtime-fanout.js";

const BREAKOUT_NAME_MAX = 100;
const BREAKOUT_AUTO_CLOSE_HOURS = 24;
export const MAX_ACTIVE_BREAKOUTS = 12;

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
  const open = await env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM breakout_rooms WHERE project_id = ? AND parent_room_id = ? AND status = 'active'`,
  )
    .bind(input.projectId, input.parentRoomId)
    .first();
  if ((open?.cnt || 0) >= MAX_ACTIVE_BREAKOUTS) {
    return { ok: false, error: "too_many_breakouts", max: MAX_ACTIVE_BREAKOUTS };
  }

  const id = generateBreakoutId();
  const now = new Date().toISOString();
  const autoCloseAt = new Date(Date.now() + BREAKOUT_AUTO_CLOSE_HOURS * 60 * 60 * 1000).toISOString();

  await env.DB.prepare(
    `INSERT INTO breakout_rooms (id, project_id, parent_room_id, name, created_by, auto_close_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, input.projectId, input.parentRoomId, input.name, input.createdBy, autoCloseAt, now)
    .run();

  await fanoutServerEvent(env, {
    projectId: input.projectId,
    roomId: input.parentRoomId,
    name: "edu.breakout.created",
    userId: input.createdBy,
    data: { breakoutId: id, name: input.name },
  }).catch(() => {});

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
    `SELECT id, status, parent_room_id FROM breakout_rooms WHERE id = ? AND project_id = ? LIMIT 1`,
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

  if (row.parent_room_id) {
    await fanoutServerEvent(env, {
      projectId: input.projectId,
      roomId: row.parent_room_id,
      name: "edu.breakout.closed",
      userId: input.closedBy,
      data: { breakoutId: input.breakoutId },
    }).catch(() => {});
  }

  return { ok: true, closedAt: now };
}

async function loadActiveBreakout(env, projectId, breakoutId) {
  const row = await env.DB.prepare(
    `SELECT id, parent_room_id, status, member_count FROM breakout_rooms
     WHERE id = ? AND project_id = ? LIMIT 1`,
  )
    .bind(breakoutId, projectId)
    .first();
  if (!row) return { ok: false, error: "breakout_not_found", status: 404 };
  if (row.status !== "active") return { ok: false, error: "already_closed", status: 400 };
  return { ok: true, row };
}

async function recountMembers(env, projectId, breakoutId) {
  const count = await env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM breakout_members WHERE project_id = ? AND breakout_id = ?`,
  )
    .bind(projectId, breakoutId)
    .first();
  await env.DB.prepare(
    `UPDATE breakout_rooms SET member_count = ? WHERE id = ? AND project_id = ?`,
  )
    .bind(count?.cnt || 0, breakoutId, projectId)
    .run();
  return count?.cnt || 0;
}

/** BBB breakoutRoomMoveUser / requestJoin — assign a member into a breakout. */
export async function joinBreakout(env, input) {
  const loaded = await loadActiveBreakout(env, input.projectId, input.breakoutId);
  if (!loaded.ok) return loaded;
  await env.DB.prepare(
    `INSERT OR IGNORE INTO breakout_members (breakout_id, project_id, user_id, joined_at)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(input.breakoutId, input.projectId, input.userId, new Date().toISOString())
    .run();
  const memberCount = await recountMembers(env, input.projectId, input.breakoutId);
  await fanoutServerEvent(env, {
    projectId: input.projectId,
    roomId: loaded.row.parent_room_id,
    name: "edu.breakout.assigned",
    userId: input.userId,
    data: { breakoutId: input.breakoutId, userId: input.userId, memberCount },
  }).catch(() => {});
  return { ok: true, breakoutId: input.breakoutId, userId: input.userId, memberCount };
}

export async function moveBreakoutUser(env, input) {
  const loaded = await loadActiveBreakout(env, input.projectId, input.breakoutId);
  if (!loaded.ok) return loaded;
  const others = await env.DB.prepare(
    `SELECT m.breakout_id FROM breakout_members m
     JOIN breakout_rooms b ON b.id = m.breakout_id
     WHERE m.project_id = ? AND m.user_id = ? AND b.parent_room_id = ? AND b.status = 'active'`,
  )
    .bind(input.projectId, input.userId, loaded.row.parent_room_id)
    .all();
  for (const row of others.results || []) {
    await env.DB.prepare(
      `DELETE FROM breakout_members WHERE breakout_id = ? AND project_id = ? AND user_id = ?`,
    )
      .bind(row.breakout_id, input.projectId, input.userId)
      .run();
    await recountMembers(env, input.projectId, row.breakout_id);
  }
  return joinBreakout(env, input);
}

export async function endAllBreakouts(env, input) {
  const rows = await env.DB.prepare(
    `SELECT id FROM breakout_rooms WHERE project_id = ? AND parent_room_id = ? AND status = 'active'`,
  )
    .bind(input.projectId, input.parentRoomId)
    .all();
  const closed = [];
  for (const row of rows.results || []) {
    const out = await closeBreakout(env, {
      projectId: input.projectId,
      breakoutId: row.id,
      closedBy: input.closedBy,
    });
    if (out.ok) closed.push(row.id);
  }
  return { ok: true, closed };
}

export async function setBreakoutTime(env, input) {
  const loaded = await loadActiveBreakout(env, input.projectId, input.breakoutId);
  if (!loaded.ok) return loaded;
  const minutes = Number(input.minutes);
  if (!Number.isFinite(minutes) || minutes <= 0) return { ok: false, error: "minutes_required" };
  const autoCloseAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  await env.DB.prepare(
    `UPDATE breakout_rooms SET auto_close_at = ? WHERE id = ? AND project_id = ?`,
  )
    .bind(autoCloseAt, input.breakoutId, input.projectId)
    .run();
  await fanoutServerEvent(env, {
    projectId: input.projectId,
    roomId: loaded.row.parent_room_id,
    name: "edu.breakout.time",
    userId: input.userId,
    data: { breakoutId: input.breakoutId, autoCloseAt, minutes },
  }).catch(() => {});
  return { ok: true, autoCloseAt };
}

export async function broadcastToBreakouts(env, input) {
  const content = String(input.content ?? "").trim();
  if (!content) return { ok: false, error: "content_required" };
  await fanoutServerEvent(env, {
    projectId: input.projectId,
    roomId: input.parentRoomId,
    name: "edu.breakout.broadcast",
    userId: input.userId,
    data: { content },
  }).catch(() => {});
  return { ok: true };
}
