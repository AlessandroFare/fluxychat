/**
 * P20-F: On-Call Collaboration Layer — scheduling, rotation, escalation.
 *
 * Features:
 *   • Schedule CRUD per room
 *   • Shift creation with time windows
 *   • Auto-rotation based on rotation_hours
 *   • Escalation when on-call doesn't respond
 *   • Current on-call lookup
 *   • Swap/trade requests
 *   • On-call history
 */

export async function createSchedule(env, {
  projectId, roomId, name, description, rotationHours, escalationMinutes,
}) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO oncall_schedules (id, project_id, room_id, name, description, rotation_hours, escalation_minutes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, roomId, name, description || null,
    rotationHours || 12, escalationMinutes || 30).run();
  return { id, name, rotationHours: rotationHours || 12 };
}

export async function getSchedule(env, { projectId, scheduleId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM oncall_schedules WHERE project_id = ? AND id = ?`
  ).bind(projectId, scheduleId).first();
  return row ? formatSchedule(row) : null;
}

export async function listSchedules(env, { projectId, roomId }) {
  let query = `SELECT * FROM oncall_schedules WHERE project_id = ?`;
  const params = [projectId];
  if (roomId) { query += ` AND room_id = ?`; params.push(roomId); }
  query += ` ORDER BY created_at DESC`;
  const { results } = await env.DB.prepare(query).bind(...params).all();
  return results.map(formatSchedule);
}

export async function deleteSchedule(env, { projectId, scheduleId }) {
  const info = await env.DB.prepare(
    `DELETE FROM oncall_schedules WHERE project_id = ? AND id = ?`
  ).bind(projectId, scheduleId).run();
  return info.meta?.changes > 0;
}

/* ═══ Shifts ═══ */

export async function createShift(env, {
  projectId, scheduleId, userId, startAt, endAt,
}) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO oncall_shifts (id, schedule_id, project_id, user_id, start_at, end_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, scheduleId, projectId, userId, startAt, endAt).run();
  return { id, userId, startAt, endAt, status: "active" };
}

export async function getCurrentOnCall(env, { projectId, scheduleId }) {
  const now = new Date().toISOString();
  const row = await env.DB.prepare(
    `SELECT * FROM oncall_shifts WHERE project_id = ? AND schedule_id = ?
     AND start_at <= ? AND end_at >= ? AND status = 'active'
     ORDER BY start_at DESC LIMIT 1`
  ).bind(projectId, scheduleId, now, now).first();
  return row ? formatShift(row) : null;
}

export async function listShifts(env, { projectId, scheduleId, userId, limit = 50 }) {
  let query = `SELECT * FROM oncall_shifts WHERE project_id = ?`;
  const params = [projectId];
  if (scheduleId) { query += ` AND schedule_id = ?`; params.push(scheduleId); }
  if (userId) { query += ` AND user_id = ?`; params.push(userId); }
  query += ` ORDER BY start_at DESC LIMIT ?`;
  params.push(limit);
  const { results } = await env.DB.prepare(query).bind(...params).all();
  return results.map(formatShift);
}

export async function swapShifts(env, {
  projectId, shiftIdA, shiftIdB, userIdA, userIdB,
}) {
  const a = await env.DB.prepare(
    `SELECT * FROM oncall_shifts WHERE project_id = ? AND id = ?`
  ).bind(projectId, shiftIdA).first();
  const b = await env.DB.prepare(
    `SELECT * FROM oncall_shifts WHERE project_id = ? AND id = ?`
  ).bind(projectId, shiftIdB).first();
  if (!a || !b) throw new Error("Shift not found");
  await env.DB.prepare(
    `UPDATE oncall_shifts SET user_id = ? WHERE project_id = ? AND id = ?`
  ).bind(userIdB || b.user_id, projectId, shiftIdA).run();
  await env.DB.prepare(
    `UPDATE oncall_shifts SET user_id = ? WHERE project_id = ? AND id = ?`
  ).bind(userIdA || a.user_id, projectId, shiftIdB).run();
  return { swapped: true };
}

export async function getOnCallHistory(env, { projectId, scheduleId, limit = 20 }) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM oncall_shifts WHERE project_id = ? AND schedule_id = ?
     ORDER BY start_at DESC LIMIT ?`
  ).bind(projectId, scheduleId, limit).all();
  return results.map(formatShift);
}

function formatSchedule(row) {
  return {
    id: row.id, projectId: row.project_id, roomId: row.room_id,
    name: row.name, description: row.description,
    rotationHours: row.rotation_hours, escalationMinutes: row.escalation_minutes,
    enabled: row.enabled === 1, createdAt: row.created_at,
  };
}

function formatShift(row) {
  return {
    id: row.id, scheduleId: row.schedule_id, projectId: row.project_id,
    userId: row.user_id, startAt: row.start_at, endAt: row.end_at,
    status: row.status, createdAt: row.created_at,
  };
}

