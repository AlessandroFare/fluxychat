/**
 * DM room find-or-create (shared by REST and chat.openDM).
 */

import { isBlockedBetween } from "./user-blocks.js";

export async function findOrCreateDmRoom(env, { projectId, userA, userB }) {
  if (!projectId || !userA || !userB) {
    return { ok: false, error: "missing_participants" };
  }
  if (userA === userB) return { ok: false, error: "same_user" };
  if (await isBlockedBetween(env, projectId, userA, userB)) {
    return { ok: false, error: "user_blocked" };
  }

  const pairKey = [userA, userB].sort().join(":");
  const existing = await env.DB.prepare(
    "SELECT id, type, name, created_at FROM rooms WHERE project_id = ? AND type = 'dm' AND name = ? LIMIT 1",
  )
    .bind(projectId, pairKey)
    .first();

  if (existing) {
    return {
      ok: true,
      created: false,
      room: {
        id: existing.id,
        type: existing.type,
        name: existing.name,
        createdAt: existing.created_at,
      },
    };
  }

  const now = new Date().toISOString();
  const roomId = crypto.randomUUID();

  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO rooms (id, project_id, type, name, created_at) VALUES (?, ?, 'dm', ?, ?)",
    ).bind(roomId, projectId, pairKey, now),
    env.DB.prepare(
      "INSERT INTO room_members (room_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)",
    ).bind(roomId, userA, now),
    env.DB.prepare(
      "INSERT INTO room_members (room_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)",
    ).bind(roomId, userB, now),
  ]);

  return {
    ok: true,
    created: true,
    room: { id: roomId, type: "dm", name: pairKey, createdAt: now },
  };
}
