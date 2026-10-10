/**
 * Stream Chat `channel.mute()` — per-user room mute (not moderation mute).
 */

function nowIso() {
  return new Date().toISOString();
}

export function muteIsActive(row, now = Date.now()) {
  if (!row) return false;
  if (!row.muted_until) return true;
  const until = Date.parse(row.muted_until);
  return Number.isFinite(until) && until > now;
}

export async function upsertChannelMute(env, { projectId, userId, roomId, mutedUntil }) {
  const until =
    mutedUntil == null || mutedUntil === ""
      ? null
      : String(mutedUntil);
  if (until && !Number.isFinite(Date.parse(until))) {
    return { ok: false, error: "invalid_muted_until" };
  }
  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO room_channel_mutes (project_id, user_id, room_id, muted_until, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(project_id, user_id, room_id) DO UPDATE SET
       muted_until = excluded.muted_until`,
  )
    .bind(projectId, userId, roomId, until, now)
    .run();
  return { ok: true, muted: true, mutedUntil: until };
}

export async function clearChannelMute(env, { projectId, userId, roomId }) {
  await env.DB.prepare(
    `DELETE FROM room_channel_mutes WHERE project_id = ? AND user_id = ? AND room_id = ?`,
  )
    .bind(projectId, userId, roomId)
    .run();
  return { ok: true, muted: false };
}

export async function getChannelMute(env, { projectId, userId, roomId }) {
  const row = await env.DB.prepare(
    `SELECT muted_until, created_at FROM room_channel_mutes
     WHERE project_id = ? AND user_id = ? AND room_id = ?`,
  )
    .bind(projectId, userId, roomId)
    .first();
  if (!muteIsActive(row)) return { muted: false };
  return { muted: true, mutedUntil: row.muted_until || null };
}

export async function isChannelMuted(env, { projectId, userId, roomId }) {
  const status = await getChannelMute(env, { projectId, userId, roomId });
  return status.muted;
}
