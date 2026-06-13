/**
 * P20-H: Hybrid Event Mode — physical + remote unified experience.
 *
 * Features:
 *   • Hybrid event config (synced polls, shared Q&A, unified chat)
 *   • QR code check-in for physical attendees
 *   • Venue URL for virtual attendees
 *   • Check-in/check-out tracking
 *   • Attendance stats (physical vs remote)
 *   • Synced polls across both audiences
 */

const HYBRID_MODES = ["synced", "parallel", "hybrid"];

export async function createHybridEvent(env, {
  projectId, roomId, eventId, name, description, mode,
  venueUrl, syncedPolls, sharedQa, unifiedChat,
}) {
  if (!HYBRID_MODES.includes(mode || "synced")) throw new Error(`Invalid hybrid mode: ${mode}`);
  const id = crypto.randomUUID();
  const qrCode = `hybrid://${projectId}/${id}`;
  await env.DB.prepare(
    `INSERT INTO hybrid_events (id, project_id, room_id, event_id, name, description,
     mode, venue_url, qr_code, synced_polls, shared_qa, unified_chat)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, roomId, eventId || null, name, description || null,
    mode || "synced", venueUrl || null, qrCode,
    syncedPolls !== false ? 1 : 0, sharedQa !== false ? 1 : 0,
    unifiedChat !== false ? 1 : 0).run();
  return { id, name, mode: mode || "synced", qrCode };
}

export async function getHybridEvent(env, { projectId, hybridEventId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM hybrid_events WHERE project_id = ? AND id = ?`
  ).bind(projectId, hybridEventId).first();
  return row ? formatHybridEvent(row) : null;
}

export async function listHybridEvents(env, { projectId, roomId }) {
  let query = `SELECT * FROM hybrid_events WHERE project_id = ?`;
  const params = [projectId];
  if (roomId) { query += ` AND room_id = ?`; params.push(roomId); }
  query += ` ORDER BY created_at DESC`;
  const { results } = await env.DB.prepare(query).bind(...params).all();
  return results.map(formatHybridEvent);
}

/* ═══ Check-in ═══ */

export async function checkIn(env, { projectId, hybridEventId, userId, checkinType }) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO hybrid_checkins (id, event_id, project_id, user_id, checkin_type)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(id, hybridEventId, projectId, userId, checkinType || "remote").run();
  const field = checkinType === "physical" ? "check_in_count" : "remote_count";
  await env.DB.prepare(
    `UPDATE hybrid_events SET ${field} = ${field} + 1 WHERE project_id = ? AND id = ?`
  ).bind(projectId, hybridEventId).run();
  return { id, checkinType: checkinType || "remote" };
}

export async function checkOut(env, { projectId, hybridEventId, userId }) {
  const info = await env.DB.prepare(
    `UPDATE hybrid_checkins SET checked_out_at = datetime('now')
     WHERE project_id = ? AND event_id = ? AND user_id = ? AND checked_out_at IS NULL`
  ).bind(projectId, hybridEventId, userId).run();
  return info.meta?.changes > 0;
}

export async function listCheckIns(env, { projectId, hybridEventId, checkinType }) {
  let query = `SELECT * FROM hybrid_checkins WHERE project_id = ? AND event_id = ?`;
  const params = [projectId, hybridEventId];
  if (checkinType) { query += ` AND checkin_type = ?`; params.push(checkinType); }
  query += ` ORDER BY checked_in_at DESC`;
  const { results } = await env.DB.prepare(query).bind(...params).all();
  return results.map(formatCheckIn);
}

export async function getHybridStats(env, { projectId, hybridEventId }) {
  const event = await getHybridEvent(env, { projectId, hybridEventId });
  const totalCheckins = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM hybrid_checkins WHERE project_id = ? AND event_id = ?`
  ).bind(projectId, hybridEventId).first();
  const byType = await env.DB.prepare(
    `SELECT checkin_type, COUNT(*) as count FROM hybrid_checkins
     WHERE project_id = ? AND event_id = ? GROUP BY checkin_type`
  ).bind(projectId, hybridEventId).all();

  return {
    event: event ? { name: event.name, mode: event.mode } : null,
    totalCheckins: totalCheckins?.total || 0,
    byType: Object.fromEntries((byType.results || byType).map(r => [r.checkin_type, r.count])),
    physicalCount: event?.checkInCount || 0,
    remoteCount: event?.remoteCount || 0,
  };
}

function formatHybridEvent(row) {
  return {
    id: row.id, projectId: row.project_id, roomId: row.room_id,
    eventId: row.event_id, name: row.name, description: row.description,
    mode: row.mode, venueUrl: row.venue_url, qrCode: row.qr_code,
    syncedPolls: row.synced_polls === 1, sharedQa: row.shared_qa === 1,
    unifiedChat: row.unified_chat === 1,
    checkInCount: row.check_in_count, remoteCount: row.remote_count,
    createdAt: row.created_at,
  };
}

function formatCheckIn(row) {
  return {
    id: row.id, eventId: row.event_id, projectId: row.project_id,
    userId: row.user_id, checkinType: row.checkin_type,
    checkedInAt: row.checked_in_at, checkedOutAt: row.checked_out_at,
  };
}
