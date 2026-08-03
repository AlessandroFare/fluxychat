/**
 * Rehearsal Rooms (#51) — ephemeral private rooms with cloned context for agent simulation.
 */

import { canAccessRoom } from "./room-access.js";
import { logInfo } from "./worker-log.js";

export const DEFAULT_REHEARSAL_TTL_SECONDS = 3600;
export const MAX_SNAPSHOT_MESSAGES = 50;
export const REHEARSAL_DISCLAIMER =
  "Simulation only — this is not the real counterparty. Practice responses here before a high-stakes conversation.";

function generateId(prefix) {
  return `${prefix}_${Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

function mapRehearsalRow(row) {
  if (!row) return null;
  return {
    rehearsalId: row.rehearsal_id,
    projectId: row.project_id,
    sourceRoomId: row.source_room_id,
    rehearsalRoomId: row.rehearsal_room_id,
    ownerUserId: row.owner_user_id,
    agentId: row.agent_id,
    snapshotTs: row.snapshot_ts,
    statedGoal: row.stated_goal,
    counterpartyRole: row.counterparty_role,
    snapshotMessageCount: Number(row.snapshot_message_count) || 0,
    ttlSeconds: Number(row.ttl_seconds) || DEFAULT_REHEARSAL_TTL_SECONDS,
    expiresAt: row.expires_at,
    persistAfterSession: row.persist_after_session === 1,
    status: row.status,
    createdAt: row.created_at,
    disclaimer: REHEARSAL_DISCLAIMER,
  };
}

export async function getRehearsalByRoomId(env, projectId, rehearsalRoomId) {
  const row = await env.DB.prepare(
    `SELECT * FROM rehearsal_rooms
     WHERE project_id = ? AND rehearsal_room_id = ? AND status = 'active'`,
  )
    .bind(projectId, rehearsalRoomId)
    .first();
  return mapRehearsalRow(row);
}

export async function getRehearsal(env, projectId, rehearsalId) {
  const row = await env.DB.prepare(
    "SELECT * FROM rehearsal_rooms WHERE project_id = ? AND rehearsal_id = ?",
  )
    .bind(projectId, rehearsalId)
    .first();
  return mapRehearsalRow(row);
}

export async function listRehearsals(env, { projectId, ownerUserId, sourceRoomId, limit = 20 }) {
  let sql = "SELECT * FROM rehearsal_rooms WHERE project_id = ?";
  const params = [projectId];
  if (ownerUserId) {
    sql += " AND owner_user_id = ?";
    params.push(ownerUserId);
  }
  if (sourceRoomId) {
    sql += " AND source_room_id = ?";
    params.push(sourceRoomId);
  }
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(Math.min(Math.max(Number(limit) || 20, 1), 100));

  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapRehearsalRow);
}

export function buildRehearsalAgentSystemPrompt(rehearsal) {
  if (!rehearsal) return null;
  const role = rehearsal.counterpartyRole?.trim() || "the other party in this conversation";
  const goal = rehearsal.statedGoal?.trim() || "practice the upcoming conversation";
  return [
    REHEARSAL_DISCLAIMER,
    `Simulated counterparty role: ${role}`,
    `Session goal: ${goal}`,
    "Stay in character as the simulated counterparty. Do not claim to be a real person.",
  ].join("\n");
}

/**
 * @param {*} env
 * @param {object} auth — JWT context with projectId, userId, roles
 */
export async function createRehearsalRoom(env, auth, input) {
  const { sourceRoomId, statedGoal, counterpartyRole, agentId, ttlSeconds, persistAfterSession } =
    input;

  if (!sourceRoomId?.trim()) {
    return { ok: false, error: "source_room_id_required" };
  }

  const canAccess = await canAccessRoom(env, auth, sourceRoomId.trim());
  if (!canAccess) {
    return { ok: false, error: "forbidden" };
  }

  const sourceRoom = await env.DB.prepare(
    "SELECT id, name FROM rooms WHERE project_id = ? AND id = ?",
  )
    .bind(auth.projectId, sourceRoomId.trim())
    .first();
  if (!sourceRoom) {
    return { ok: false, error: "source_room_not_found" };
  }

  const ttl = Math.min(
    Math.max(Number(ttlSeconds) || DEFAULT_REHEARSAL_TTL_SECONDS, 300),
    86_400,
  );
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + ttl * 1000).toISOString();
  const rehearsalId = generateId("reh");
  const rehearsalRoomId = `rehearsal_${rehearsalId}`;

  const snapshotRows = await env.DB.prepare(
    `SELECT id, user_id, content, created_at, parent_id
     FROM messages
     WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
  )
    .bind(auth.projectId, sourceRoomId.trim(), MAX_SNAPSHOT_MESSAGES)
    .all();

  const chronological = (snapshotRows.results || []).reverse();

  await env.DB.prepare(
    "INSERT INTO rooms (id, project_id, type, name, created_at) VALUES (?, ?, 'group', ?, ?)",
  )
    .bind(
      rehearsalRoomId,
      auth.projectId,
      `Rehearsal: ${String(sourceRoom.name || sourceRoomId).slice(0, 80)}`,
      nowIso,
    )
    .run();

  await env.DB.prepare(
    "INSERT INTO room_members (room_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)",
  )
    .bind(rehearsalRoomId, auth.userId, nowIso)
    .run();

  if (agentId?.trim()) {
    const agent = await env.DB.prepare(
      "SELECT id FROM bots WHERE project_id = ? AND id = ?",
    )
      .bind(auth.projectId, agentId.trim())
      .first();
    if (agent) {
      await env.DB.prepare(
        "INSERT OR IGNORE INTO room_members (room_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)",
      )
        .bind(rehearsalRoomId, agentId.trim(), nowIso)
        .run();
    }
  }

  const disclaimerContent = [
    `⚠️ ${REHEARSAL_DISCLAIMER}`,
    counterpartyRole?.trim() ? `Role: ${counterpartyRole.trim()}` : null,
    statedGoal?.trim() ? `Goal: ${statedGoal.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  await env.DB.prepare(
    `INSERT INTO messages (project_id, room_id, user_id, content, created_at, kind)
     VALUES (?, ?, ?, ?, ?, 'system')`,
  )
    .bind(auth.projectId, rehearsalRoomId, "system", disclaimerContent, nowIso)
    .run();

  for (const msg of chronological) {
    const content = `[context] ${String(msg.content || "").slice(0, 4000)}`;
    await env.DB.prepare(
      `INSERT INTO messages (project_id, room_id, user_id, content, created_at, parent_id, kind)
       VALUES (?, ?, ?, ?, ?, ?, 'rehearsal_context')`,
    )
      .bind(
        auth.projectId,
        rehearsalRoomId,
        msg.user_id,
        content,
        msg.created_at,
        msg.parent_id ?? null,
      )
      .run();
  }

  await env.DB.prepare(
    `INSERT INTO rehearsal_rooms
     (rehearsal_id, project_id, source_room_id, rehearsal_room_id, owner_user_id, agent_id,
      snapshot_ts, stated_goal, counterparty_role, snapshot_message_count, ttl_seconds,
      expires_at, persist_after_session, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
  )
    .bind(
      rehearsalId,
      auth.projectId,
      sourceRoomId.trim(),
      rehearsalRoomId,
      auth.userId,
      agentId?.trim() || null,
      nowIso,
      statedGoal?.trim() || null,
      counterpartyRole?.trim() || null,
      chronological.length,
      ttl,
      expiresAt,
      persistAfterSession ? 1 : 0,
      nowIso,
    )
    .run();

  logInfo("rehearsal.created", {
    projectId: auth.projectId,
    rehearsalId,
    sourceRoomId: sourceRoomId.trim(),
    rehearsalRoomId,
    snapshotCount: chronological.length,
  });

  return {
    ok: true,
    rehearsal: await getRehearsal(env, auth.projectId, rehearsalId),
  };
}

export async function deleteRehearsalRoom(env, projectId, rehearsalId) {
  const row = await getRehearsal(env, projectId, rehearsalId);
  if (!row) return { ok: false, error: "not_found" };

  await env.DB.prepare("DELETE FROM messages WHERE project_id = ? AND room_id = ?")
    .bind(projectId, row.rehearsalRoomId)
    .run();
  await env.DB.prepare("DELETE FROM room_members WHERE room_id = ?")
    .bind(row.rehearsalRoomId)
    .run();
  await env.DB.prepare("DELETE FROM rooms WHERE project_id = ? AND id = ?")
    .bind(projectId, row.rehearsalRoomId)
    .run();
  await env.DB.prepare(
    "UPDATE rehearsal_rooms SET status = 'expired' WHERE project_id = ? AND rehearsal_id = ?",
  )
    .bind(projectId, rehearsalId)
    .run();

  return { ok: true, rehearsalId };
}

export async function expireRehearsalRooms(env) {
  if (!env?.DB) return { expired: 0 };
  const now = new Date().toISOString();
  const rows = await env.DB.prepare(
    `SELECT rehearsal_id, project_id FROM rehearsal_rooms
     WHERE status = 'active' AND persist_after_session = 0 AND expires_at < ?`,
  )
    .bind(now)
    .all();

  let expired = 0;
  for (const row of rows.results || []) {
    await deleteRehearsalRoom(env, row.project_id, row.rehearsal_id);
    expired++;
  }

  if (expired > 0) {
    logInfo("rehearsal.expired", { expired, at: now });
  }
  return { expired };
}
