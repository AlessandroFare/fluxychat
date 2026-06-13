import { logInfo } from "./worker-log.js";

function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const VALID_TYPES = ["cursor", "focus", "scroll", "selection", "viewing"];

export function isValidPresenceType(type) {
  return VALID_TYPES.includes(type);
}

export async function updatePresence(env, { projectId, roomId, userId, type, payload }) {
  if (!isValidPresenceType(type)) {
    return { error: `type must be one of: ${VALID_TYPES.join(", ")}` };
  }

  const now = new Date().toISOString();
  const id = `pres_${generateId().slice(0, 12)}`;
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const existing = await env.DB.prepare(
    "SELECT id FROM presence_extensions WHERE room_id = ? AND user_id = ? AND presence_type = ?"
  )
    .bind(roomId, userId, type)
    .first();

  if (existing) {
    await env.DB.prepare(
      "UPDATE presence_extensions SET payload_json = ?, updated_at = ?, expires_at = ? WHERE id = ?"
    )
      .bind(JSON.stringify(payload), now, expiresAt, existing.id)
      .run();
    return { id: existing.id, updated: true };
  }

  await env.DB.prepare(
    "INSERT INTO presence_extensions (id, project_id, room_id, user_id, presence_type, payload_json, updated_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(id, projectId, roomId, userId, type, JSON.stringify(payload), now, expiresAt)
    .run();

  return { id, created: true };
}

export async function getPresenceByRoom(env, { roomId, type, includeStale = false }) {
  let query = "SELECT * FROM presence_extensions WHERE room_id = ?";
  const params = [roomId];

  if (type) {
    query += " AND presence_type = ?";
    params.push(type);
  }

  if (!includeStale) {
    query += " AND (expires_at IS NULL OR expires_at > ?)";
    params.push(new Date().toISOString());
  }

  query += " ORDER BY updated_at DESC";

  const rows = await env.DB.prepare(query).bind(...params).all();
  return (rows.results || []).map(mapPresenceRow);
}

export async function getPresenceByUser(env, { userId, projectId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM presence_extensions WHERE user_id = ? AND project_id = ? AND (expires_at IS NULL OR expires_at > ?) ORDER BY updated_at DESC"
  )
    .bind(userId, projectId, new Date().toISOString())
    .all();

  return (rows.results || []).map(mapPresenceRow);
}

export async function getPresenceSnapshot(env, { roomId }) {
  const rows = await env.DB.prepare(
    "SELECT user_id, presence_type, payload_json, updated_at FROM presence_extensions WHERE room_id = ? AND (expires_at IS NULL OR expires_at > ?) ORDER BY updated_at DESC"
  )
    .bind(roomId, new Date().toISOString())
    .all();

  const byUser = {};
  for (const row of rows.results || []) {
    if (!byUser[row.user_id]) byUser[row.user_id] = {};
    byUser[row.user_id][row.presence_type] = {
      payload: JSON.parse(row.payload_json || "{}"),
      updatedAt: row.updated_at,
    };
  }
  return byUser;
}

export async function getCursorsByRoom(env, { roomId }) {
  return getPresenceByRoom(env, { roomId, type: "cursor" });
}

export async function getFocusByRoom(env, { roomId }) {
  return getPresenceByRoom(env, { roomId, type: "focus" });
}

export async function clearPresence(env, { roomId, userId, type }) {
  let query = "DELETE FROM presence_extensions WHERE room_id = ?";
  const params = [roomId];

  if (userId) {
    query += " AND user_id = ?";
    params.push(userId);
  }
  if (type) {
    query += " AND presence_type = ?";
    params.push(type);
  }

  const result = await env.DB.prepare(query).bind(...params).run();
  return { deleted: result.meta?.changes || 0 };
}

export async function clearStalePresence(env) {
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    "DELETE FROM presence_extensions WHERE expires_at IS NOT NULL AND expires_at < ?"
  )
    .bind(now)
    .run();
  return { deleted: result.meta?.changes || 0 };
}

export async function getPresenceStats(env, { roomId }) {
  const rows = await env.DB.prepare(
    "SELECT presence_type, COUNT(DISTINCT user_id) as user_count FROM presence_extensions WHERE room_id = ? AND (expires_at IS NULL OR expires_at > ?) GROUP BY presence_type"
  )
    .bind(roomId, new Date().toISOString())
    .all();

  const stats = {};
  for (const row of rows.results || []) {
    stats[row.presence_type] = row.user_count;
  }
  return stats;
}

function mapPresenceRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    roomId: row.room_id,
    userId: row.user_id,
    type: row.presence_type,
    payload: JSON.parse(row.payload_json || "{}"),
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
  };
}
