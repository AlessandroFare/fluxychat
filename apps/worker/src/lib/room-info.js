/**
 * NW-105 — aggregated room info for dashboard slide-over.
 */
import { fetchAggregatedRoomLive } from "./room-shard.js";

/**
 * @param {*} env
 * @param {{ projectId: string, roomId: string }} input
 */
export async function getRoomInfoPanel(env, input) {
  const row = await env.DB.prepare(
    `SELECT id, name, type, description, created_at, e2e_enabled, shard_count
     FROM rooms WHERE id = ? AND project_id = ? LIMIT 1`,
  )
    .bind(input.roomId, input.projectId)
    .first();

  if (!row) return { ok: false, error: "room_not_found" };

  const members = await env.DB.prepare(
    `SELECT user_id, role, joined_at FROM room_members WHERE room_id = ? ORDER BY joined_at ASC LIMIT 100`,
  )
    .bind(input.roomId)
    .all();

  const messageCountRow = await env.DB.prepare(
    `SELECT COUNT(*) as c FROM messages WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL`,
  )
    .bind(input.projectId, input.roomId)
    .first();

  const pinRows = await env.DB.prepare(
    `SELECT message_id, pinned_by, pinned_at FROM pinned_messages
     WHERE project_id = ? AND room_id = ? ORDER BY pinned_at DESC LIMIT 10`,
  )
    .bind(input.projectId, input.roomId)
    .all();

  let retention = null;
  try {
    const retentionRow = await env.DB.prepare(
      `SELECT mode, ttl_seconds, updated_at FROM room_message_retention
       WHERE project_id = ? AND room_id = ? LIMIT 1`,
    )
      .bind(input.projectId, input.roomId)
      .first();
    if (retentionRow) {
      retention = {
        mode: retentionRow.mode,
        ttlSeconds: retentionRow.ttl_seconds,
        updatedAt: retentionRow.updated_at,
      };
    }
  } catch {
    /* table optional pre-migration */
  }

  let live = null;
  try {
    live = await fetchAggregatedRoomLive(env, input.projectId, input.roomId);
  } catch {
    live = null;
  }

  return {
    ok: true,
    room: {
      id: row.id,
      name: row.name,
      type: row.type,
      description: row.description,
      createdAt: row.created_at,
      e2eEnabled: row.e2e_enabled === 1,
      shardCount: row.shard_count ?? 1,
    },
    members: (members.results || []).map((m) => ({
      userId: m.user_id,
      role: m.role,
      joinedAt: m.joined_at,
    })),
    memberCount: (members.results || []).length,
    messageCount: Number(messageCountRow?.c) || 0,
    pins: (pinRows.results || []).map((p) => ({
      messageId: Number(p.message_id),
      pinnedBy: p.pinned_by,
      pinnedAt: p.pinned_at,
    })),
    retention,
    live: live
      ? {
          online: live.online,
          userCount: live.userCount,
          users: live.users,
        }
      : null,
  };
}
