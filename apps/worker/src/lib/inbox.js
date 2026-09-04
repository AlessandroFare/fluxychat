import { getRoomCatchUpForUser } from "./room-catch-up.js";
import { listUserThreads } from "./message-threads.js";

const MENTION_LIMIT = 50;
const ROOM_LIMIT = 100;

function canBypassRoomMembership(roles) {
  if (!Array.isArray(roles)) return false;
  return roles.some((r) => ["owner", "admin", "moderator", "bot"].includes(r));
}

function previewContent(content, max = 120) {
  return String(content || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/**
 * @param {*} env
 * @param {string} projectId
 * @param {string} userId
 * @param {string[] | undefined} roles
 */
async function listAccessibleRoomIds(env, projectId, userId, roles) {
  if (canBypassRoomMembership(roles)) {
    const rows = await env.DB.prepare(
      "SELECT id FROM rooms WHERE project_id = ? ORDER BY created_at DESC LIMIT ?",
    )
      .bind(projectId, ROOM_LIMIT)
      .all();
    return (rows.results || []).map((r) => r.id);
  }
  const rows = await env.DB.prepare(
    `SELECT r.id FROM rooms r
     INNER JOIN room_members rm ON rm.room_id = r.id
     WHERE r.project_id = ? AND rm.user_id = ?
     ORDER BY r.created_at DESC LIMIT ?`,
  )
    .bind(projectId, userId, ROOM_LIMIT)
    .all();
  return (rows.results || []).map((r) => r.id);
}

async function loadSnoozeMap(env, projectId, userId) {
  const now = new Date().toISOString();
  const rows = await env.DB.prepare(
    `SELECT room_id, snooze_until FROM inbox_snoozes
     WHERE project_id = ? AND user_id = ? AND snooze_until > ?`,
  )
    .bind(projectId, userId, now)
    .all();
  return new Map((rows.results || []).map((r) => [r.room_id, r.snooze_until]));
}

async function loadRoomMeta(env, projectId, roomIds) {
  if (!roomIds.length) return new Map();
  const placeholders = roomIds.map(() => "?").join(", ");
  const rows = await env.DB.prepare(
    `SELECT id, name, type FROM rooms WHERE project_id = ? AND id IN (${placeholders})`,
  )
    .bind(projectId, ...roomIds)
    .all();
  return new Map((rows.results || []).map((r) => [r.id, r]));
}

async function loadLastMessagePreview(env, projectId, roomId) {
  const row = await env.DB.prepare(
    `SELECT id, user_id, content, created_at FROM messages
     WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL
     ORDER BY id DESC LIMIT 1`,
  )
    .bind(projectId, roomId)
    .first();
  if (!row) return null;
  return {
    messageId: row.id,
    userId: row.user_id,
    preview: previewContent(row.content),
    createdAt: row.created_at,
  };
}

/**
 * @param {*} env
 * @param {{ projectId: string, userId: string, roles?: string[] }} scope
 */
export async function getInboxSummary(env, scope) {
  const { projectId, userId, roles } = scope;
  const snoozeMap = await loadSnoozeMap(env, projectId, userId);
  const roomIds = await listAccessibleRoomIds(env, projectId, userId, roles);
  const roomMeta = await loadRoomMeta(env, projectId, roomIds);

  const unreadRooms = [];
  const snoozedRooms = [];

  for (const roomId of roomIds) {
    const meta = roomMeta.get(roomId);
    if (!meta) continue;
    const catchUp = await getRoomCatchUpForUser(env.DB, { projectId, roomId, userId });
    const lastMessage = await loadLastMessagePreview(env, projectId, roomId);
    const snoozedUntil = snoozeMap.get(roomId) || null;
    const entry = {
      roomId,
      roomName: meta.name || roomId,
      roomType: meta.type,
      unreadCount: catchUp.unreadCount,
      lastReadMessageId: catchUp.lastReadMessageId,
      firstUnreadMessageId: catchUp.firstUnreadMessageId,
      lastMessage,
      snoozedUntil,
    };
    if (snoozedUntil) {
      snoozedRooms.push(entry);
    } else if (catchUp.unreadCount > 0) {
      unreadRooms.push(entry);
    }
  }

  unreadRooms.sort((a, b) => {
    const ta = a.lastMessage?.createdAt || "";
    const tb = b.lastMessage?.createdAt || "";
    return tb.localeCompare(ta);
  });
  snoozedRooms.sort((a, b) => String(a.snoozedUntil).localeCompare(String(b.snoozedUntil)));

  const mentionRows = await env.DB.prepare(
    `SELECT mm.message_id, mm.room_id, mm.created_at,
            m.user_id AS author_id, m.content,
            r.name AS room_name, r.type AS room_type
     FROM message_mentions mm
     INNER JOIN messages m ON m.id = mm.message_id AND m.project_id = mm.project_id
     INNER JOIN rooms r ON r.id = mm.room_id AND r.project_id = mm.project_id
     WHERE mm.project_id = ? AND mm.mentioned_user_id = ?
       AND m.deleted_at IS NULL
     ORDER BY mm.created_at DESC
     LIMIT ?`,
  )
    .bind(projectId, userId, MENTION_LIMIT)
    .all();

  const mentions = [];
  for (const row of mentionRows.results || []) {
    if (!roomIds.includes(row.room_id) && !canBypassRoomMembership(roles)) continue;
    const catchUp = await getRoomCatchUpForUser(env.DB, {
      projectId,
      roomId: row.room_id,
      userId,
    });
    const isUnread = Number(row.message_id) > catchUp.lastReadMessageId;
    mentions.push({
      messageId: row.message_id,
      roomId: row.room_id,
      roomName: row.room_name || row.room_id,
      roomType: row.room_type,
      authorId: row.author_id,
      preview: previewContent(row.content),
      createdAt: row.created_at,
      isUnread,
    });
  }

  const followUpRows = await env.DB.prepare(
    `SELECT id, room_id, message_id, note, due_at, status, created_at, completed_at
     FROM inbox_follow_ups
     WHERE project_id = ? AND user_id = ? AND status = 'open'
     ORDER BY COALESCE(due_at, created_at) ASC
     LIMIT 100`,
  )
    .bind(projectId, userId)
    .all();

  const followUps = [];
  for (const row of followUpRows.results || []) {
    const meta = roomMeta.get(row.room_id) || (await loadRoomMeta(env, projectId, [row.room_id])).get(row.room_id);
    followUps.push({
      id: row.id,
      roomId: row.room_id,
      roomName: meta?.name || row.room_id,
      messageId: row.message_id,
      note: row.note,
      dueAt: row.due_at,
      status: row.status,
      createdAt: row.created_at,
    });
  }

  const mine = await listUserThreads(env, {
    projectId,
    userId,
    roles,
    limit: 50,
  }).catch(() => ({ threads: [] }));

  const threads = (mine.threads || []).map((t) => ({
    threadId: t.rootMessageId,
    parentThreadId: null,
    rootThreadId: t.rootMessageId,
    roomId: t.roomId,
    unreadCount: t.unreadCount,
    preview: t.rootPreview,
    lastReplyAt: t.lastReply?.createdAt ?? t.rootCreatedAt,
  }));

  return {
    mentions,
    unreadRooms,
    snoozedRooms,
    followUps,
    threads,
    counts: {
      mentions: mentions.length,
      unreadRooms: unreadRooms.length,
      snoozedRooms: snoozedRooms.length,
      followUps: followUps.length,
      threads: threads.length,
    },
  };
}

/**
 * @param {*} env
 * @param {{ projectId: string, userId: string, roomId: string, snoozeUntil: string }} input
 */
export async function upsertRoomSnooze(env, input) {
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO inbox_snoozes (project_id, user_id, room_id, snooze_until, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, user_id, room_id) DO UPDATE SET
       snooze_until = excluded.snooze_until,
       updated_at = excluded.updated_at`,
  )
    .bind(input.projectId, input.userId, input.roomId, input.snoozeUntil, now, now)
    .run();
  return { ok: true, snoozeUntil: input.snoozeUntil };
}

export async function clearRoomSnooze(env, { projectId, userId, roomId }) {
  await env.DB.prepare(
    `DELETE FROM inbox_snoozes WHERE project_id = ? AND user_id = ? AND room_id = ?`,
  )
    .bind(projectId, userId, roomId)
    .run();
  return { ok: true };
}

/**
 * @param {*} env
 * @param {{ projectId: string, userId: string, roomId: string, messageId?: number | null, note?: string | null, dueAt?: string | null }} input
 */
export async function createFollowUp(env, input) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO inbox_follow_ups
       (id, project_id, user_id, room_id, message_id, note, due_at, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
  )
    .bind(
      id,
      input.projectId,
      input.userId,
      input.roomId,
      input.messageId ?? null,
      input.note ?? null,
      input.dueAt ?? null,
      now,
    )
    .run();
  return { ok: true, id };
}

export async function updateFollowUpStatus(env, { projectId, userId, id, status }) {
  const now = new Date().toISOString();
  const completedAt = status === "done" ? now : null;
  const result = await env.DB.prepare(
    `UPDATE inbox_follow_ups
     SET status = ?, completed_at = ?
     WHERE id = ? AND project_id = ? AND user_id = ?`,
  )
    .bind(status, completedAt, id, projectId, userId)
    .run();
  if (!result.meta?.changes) return { ok: false, error: "not_found" };
  return { ok: true };
}

export async function deleteFollowUp(env, { projectId, userId, id }) {
  const result = await env.DB.prepare(
    `DELETE FROM inbox_follow_ups WHERE id = ? AND project_id = ? AND user_id = ?`,
  )
    .bind(id, projectId, userId)
    .run();
  if (!result.meta?.changes) return { ok: false, error: "not_found" };
  return { ok: true };
}

/**
 * Parse snooze duration from API body.
 * @param {{ until?: string, minutes?: number, hours?: number }} body
 */
export function resolveSnoozeUntil(body) {
  if (body?.until) {
    const until = new Date(body.until);
    if (Number.isNaN(until.getTime())) return null;
    return until.toISOString();
  }
  const minutes = Number(body?.minutes ?? 0) + Number(body?.hours ?? 0) * 60;
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return new Date(Date.now() + minutes * 60_000).toISOString();
}
