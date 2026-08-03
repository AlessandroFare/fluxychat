/**
 * Room message retention and ephemeral TTL (roadmap #19).
 */

import { getMessageTtlMaxSeconds } from "./message-ttl.js";

const MIN_TTL_SECONDS = 60;

/**
 * Compute default expires_at for messages in ephemeral/custom rooms (no client TTL).
 * @param {{ mode: string, ttlSeconds: number | null }} settings
 * @param {unknown} env
 * @returns {string | null}
 */
export function resolveRoomDefaultExpiresAt(settings, env) {
  if (!settings || settings.mode === "standard" || !settings.ttlSeconds) return null;
  const maxSeconds = getMessageTtlMaxSeconds(env);
  const ttl = Math.min(Math.floor(settings.ttlSeconds), maxSeconds);
  if (ttl < MIN_TTL_SECONDS) return null;
  return new Date(Date.now() + ttl * 1000).toISOString();
}

/**
 * Merge client-requested expiry with room policy (strictest wins).
 * @param {string | null} clientExpiresAt
 * @param {string | null} roomExpiresAt
 * @returns {string | null}
 */
export function mergeMessageExpiry(clientExpiresAt, roomExpiresAt) {
  if (clientExpiresAt && roomExpiresAt) {
    return new Date(clientExpiresAt) <= new Date(roomExpiresAt)
      ? clientExpiresAt
      : roomExpiresAt;
  }
  return clientExpiresAt || roomExpiresAt || null;
}

/**
 * Resolve final message expiry: client body + room retention policy.
 */
export async function resolveMessageExpiryWithRoomPolicy(env, projectId, roomId, body) {
  const { resolveMessageExpiry } = await import("./message-ttl.js");
  const clientResult = resolveMessageExpiry(body, env);
  if (!clientResult.ok) return clientResult;

  const settings = await getRoomRetentionSettings(env, projectId, roomId);
  const roomDefault = resolveRoomDefaultExpiresAt(settings, env);
  return {
    ok: true,
    expiresAt: mergeMessageExpiry(clientResult.expiresAt, roomDefault),
    retentionMode: settings.mode,
  };
}

export async function getRoomRetentionSettings(env, projectId, roomId) {
  const row = await env.DB.prepare(
    `SELECT mode, ttl_seconds, updated_at FROM room_message_retention
     WHERE project_id = ? AND room_id = ?`,
  )
    .bind(projectId, roomId)
    .first();

  if (!row) {
    return {
      mode: "standard",
      ttlSeconds: null,
      updatedAt: null,
    };
  }

  return {
    mode: row.mode,
    ttlSeconds: row.ttl_seconds != null ? Number(row.ttl_seconds) : null,
    updatedAt: row.updated_at,
  };
}

export async function upsertRoomRetentionSettings(env, projectId, roomId, input) {
  const mode = input.mode || "standard";
  if (!["standard", "ephemeral", "custom"].includes(mode)) {
    return { ok: false, error: "invalid_mode" };
  }

  let ttlSeconds = input.ttlSeconds ?? null;
  if (mode === "ephemeral" && (!ttlSeconds || ttlSeconds < 60)) {
    ttlSeconds = 86400;
  }
  if (mode === "standard") {
    ttlSeconds = null;
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO room_message_retention (room_id, project_id, mode, ttl_seconds, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(project_id, room_id) DO UPDATE SET
       mode = excluded.mode,
       ttl_seconds = excluded.ttl_seconds,
       updated_at = excluded.updated_at`,
  )
    .bind(roomId, projectId, mode, ttlSeconds, now)
    .run();

  return {
    ok: true,
    settings: {
      mode,
      ttlSeconds,
      updatedAt: now,
    },
  };
}

/**
 * Delete messages older than room TTL. Returns count purged.
 */
export async function purgeExpiredRoomMessages(env, { projectId, roomId, limit = 500 }) {
  const settings = await getRoomRetentionSettings(env, projectId, roomId);
  if (settings.mode === "standard" || !settings.ttlSeconds) {
    return { ok: true, purged: 0, skipped: true };
  }

  const cutoff = new Date(Date.now() - settings.ttlSeconds * 1000).toISOString();

  const batch = await env.DB.prepare(
    `SELECT id FROM messages
     WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL AND created_at < ?
     ORDER BY created_at ASC
     LIMIT ?`,
  )
    .bind(projectId, roomId, cutoff, limit)
    .all();

  const ids = (batch.results || []).map((row) => row.id);
  if (!ids.length) {
    return { ok: true, purged: 0, cutoff, mode: settings.mode };
  }

  const placeholders = ids.map(() => "?").join(",");
  const result = await env.DB.prepare(
    `UPDATE messages SET deleted_at = datetime('now')
     WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
  )
    .bind(...ids)
    .run();

  return { ok: true, purged: result.meta?.changes || 0, cutoff, mode: settings.mode };
}

export async function purgeAllConfiguredRoomRetention(env, { limitPerRoom = 500 } = {}) {
  const rows = await env.DB.prepare(
    `SELECT project_id, room_id FROM room_message_retention
     WHERE mode != 'standard' AND ttl_seconds IS NOT NULL`,
  ).all();

  let purged = 0;
  for (const row of rows.results || []) {
    const result = await purgeExpiredRoomMessages(env, {
      projectId: row.project_id,
      roomId: row.room_id,
      limit: limitPerRoom,
    });
    purged += result.purged || 0;
  }

  return { ok: true, purged, rooms: (rows.results || []).length };
}

export async function listRoomsWithRetention(env, projectId) {
  const rows = await env.DB.prepare(
    `SELECT room_id, mode, ttl_seconds, updated_at FROM room_message_retention
     WHERE project_id = ? ORDER BY updated_at DESC`,
  )
    .bind(projectId)
    .all();

  return (rows.results || []).map((row) => ({
    roomId: row.room_id,
    mode: row.mode,
    ttlSeconds: row.ttl_seconds != null ? Number(row.ttl_seconds) : null,
    updatedAt: row.updated_at,
  }));
}
