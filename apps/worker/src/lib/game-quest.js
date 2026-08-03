/**
 * Game quests with basic content moderation before fan-out to rooms.
 */

import { fanoutServerEvent } from "./message-realtime-fanout.js";

const QUEST_BLOCKED_PATTERNS = [
  /\b(cheat|hack|aimbot|wallhack)\b/i,
  /\b(buy\s+gold|sell\s+account|real\s+money)\b/i,
  /\b(nazi|slur)\b/i,
];

function parseJson(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function rowToQuest(row) {
  return {
    id: row.id,
    roomId: row.room_id ?? undefined,
    title: row.title,
    description: row.description ?? undefined,
    objectives: parseJson(row.objectives_json, []),
    moderationStatus: row.moderation_status,
    moderationReason: row.moderation_reason ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function scanQuestContent(title, description) {
  const text = `${title} ${description ?? ""}`.trim();
  for (const pattern of QUEST_BLOCKED_PATTERNS) {
    if (pattern.test(text)) {
      return { ok: false, reason: "blocked_content", pattern: pattern.source };
    }
  }
  return { ok: true };
}

export async function createGameQuest(env, auth, input) {
  const title = String(input.title ?? "").trim().slice(0, 120);
  const description = input.description ? String(input.description).trim().slice(0, 500) : null;
  const objectives = Array.isArray(input.objectives) ? input.objectives.slice(0, 20) : [];
  const roomId = input.roomId ? String(input.roomId).trim().slice(0, 128) : null;

  if (!title) return { ok: false, error: "title_required" };

  const scan = scanQuestContent(title, description);
  const moderationStatus = scan.ok ? "approved" : "pending";
  const moderationReason = scan.ok ? null : scan.reason;

  const id = `quest_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO game_quests
     (id, project_id, room_id, title, description, objectives_json, moderation_status, moderation_reason, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      auth.projectId,
      roomId,
      title,
      description,
      JSON.stringify(objectives),
      moderationStatus,
      moderationReason,
      auth.userId,
      now,
      now,
    )
    .run();

  const quest = rowToQuest({
    id,
    project_id: auth.projectId,
    room_id: roomId,
    title,
    description,
    objectives_json: JSON.stringify(objectives),
    moderation_status: moderationStatus,
    moderation_reason: moderationReason,
    created_by: auth.userId,
    created_at: now,
    updated_at: now,
  });

  if (moderationStatus === "approved" && roomId) {
    await fanoutServerEvent(env, {
      projectId: auth.projectId,
      roomId,
      name: "game.quest_created",
      userId: auth.userId,
      data: { quest },
    }).catch(() => {});
  }

  return { ok: true, quest, pendingModeration: moderationStatus === "pending" };
}

export async function listGameQuests(env, auth, filter = {}) {
  let sql = "SELECT * FROM game_quests WHERE project_id = ?";
  const params = [auth.projectId];
  if (filter.status) {
    sql += " AND moderation_status = ?";
    params.push(filter.status);
  }
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(Math.min(Number(filter.limit) || 50, 100));

  const rows = await env.DB.prepare(sql).bind(...params).all();
  return { ok: true, quests: (rows.results || []).map(rowToQuest) };
}

export async function moderateGameQuest(env, auth, questId, decision) {
  const status = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : null;
  if (!status) return { ok: false, error: "invalid_decision" };

  const row = await env.DB.prepare(
    "SELECT * FROM game_quests WHERE id = ? AND project_id = ?",
  )
    .bind(questId, auth.projectId)
    .first();
  if (!row) return { ok: false, error: "not_found" };

  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE game_quests SET moderation_status = ?, moderation_reason = ?, updated_at = ? WHERE id = ? AND project_id = ?`,
  )
    .bind(status, status === "rejected" ? "manual_reject" : null, now, questId, auth.projectId)
    .run();

  const quest = rowToQuest({ ...row, moderation_status: status, updated_at: now });

  if (status === "approved" && row.room_id) {
    await fanoutServerEvent(env, {
      projectId: auth.projectId,
      roomId: row.room_id,
      name: "game.quest_created",
      userId: auth.userId,
      data: { quest },
    }).catch(() => {});
  }

  return { ok: true, quest };
}

export async function updateGameQuestProgress(env, auth, questId, input) {
  const row = await env.DB.prepare(
    "SELECT * FROM game_quests WHERE id = ? AND project_id = ? AND moderation_status = 'approved'",
  )
    .bind(questId, auth.projectId)
    .first();
  if (!row) return { ok: false, error: "quest_not_available" };

  const playerId = String(input.playerId ?? auth.userId).trim();
  const progress = input.progress && typeof input.progress === "object" ? input.progress : {};
  const completed = Boolean(input.completed);
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO game_quest_progress (project_id, quest_id, player_id, progress_json, completed, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, quest_id, player_id) DO UPDATE SET
       progress_json = excluded.progress_json,
       completed = excluded.completed,
       updated_at = excluded.updated_at`,
  )
    .bind(auth.projectId, questId, playerId, JSON.stringify(progress), completed ? 1 : 0, now)
    .run();

  if (row.room_id) {
    await fanoutServerEvent(env, {
      projectId: auth.projectId,
      roomId: row.room_id,
      name: "game.quest_progress",
      userId: playerId,
      data: { questId, playerId, progress, completed },
    }).catch(() => {});
  }

  return { ok: true, questId, playerId, progress, completed };
}
