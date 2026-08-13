/**
 * NW-106 — list reply threads the user participates in.
 */
import { collectThreadMessages } from "./thread-summary.js";

const ROOM_LIMIT = 100;
const PARTICIPATION_LIMIT = 200;
const DEFAULT_THREAD_LIMIT = 50;
const PREVIEW_MAX = 140;

function previewContent(content, max = PREVIEW_MAX) {
  return String(content || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function canBypassRoomMembership(roles) {
  if (!Array.isArray(roles)) return false;
  return roles.some((r) => ["owner", "admin", "moderator", "bot"].includes(r));
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

/**
 * @param {*} env
 * @param {string} projectId
 * @param {string} roomId
 * @param {number} messageId
 */
async function resolveThreadRootId(env, projectId, roomId, messageId) {
  let currentId = messageId;
  for (let depth = 0; depth < 20; depth++) {
    const row = await env.DB.prepare(
      `SELECT id, parent_id FROM messages
       WHERE project_id = ? AND room_id = ? AND id = ? AND deleted_at IS NULL
       LIMIT 1`,
    )
      .bind(projectId, roomId, currentId)
      .first();
    if (!row) return null;
    if (!row.parent_id) return Number(row.id);
    currentId = Number(row.parent_id);
  }
  return null;
}

/**
 * @param {*} env
 * @param {{ projectId: string, roomId: string, rootId: number, userId: string }} input
 */
async function buildThreadListItem(env, input) {
  const collected = await collectThreadMessages(env, {
    projectId: input.projectId,
    roomId: input.roomId,
    messageId: input.rootId,
  });
  if (!collected.ok || collected.messages.length < 2) return null;

  const messages = collected.messages;
  const root = messages[0];
  const last = messages[messages.length - 1];
  const userMessages = messages.filter((m) => m.userId === input.userId);
  const lastUserMsg = userMessages.length ? userMessages[userMessages.length - 1] : null;

  let unreadCount = 0;
  if (lastUserMsg) {
    const idx = messages.findIndex((m) => m.id === lastUserMsg.id);
    unreadCount = messages.slice(idx + 1).filter((m) => m.userId !== input.userId).length;
  } else {
    unreadCount = messages.filter((m) => m.userId !== input.userId).length;
  }

  return {
    rootMessageId: collected.rootId,
    roomId: input.roomId,
    rootPreview: previewContent(root.content),
    rootUserId: root.userId,
    rootCreatedAt: root.createdAt,
    replyCount: messages.length - 1,
    lastReply: {
      messageId: last.id,
      userId: last.userId,
      preview: previewContent(last.content),
      createdAt: last.createdAt,
    },
    unreadCount,
    userParticipated: userMessages.length > 0,
  };
}

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   userId: string,
 *   roles?: string[],
 *   limit?: number,
 *   unreadOnly?: boolean,
 * }} scope
 */
export async function listUserThreads(env, scope) {
  const limit = Math.min(Math.max(scope.limit ?? DEFAULT_THREAD_LIMIT, 1), 100);
  const roomIds = await listAccessibleRoomIds(env, scope.projectId, scope.userId, scope.roles);
  if (!roomIds.length) {
    return { threads: [], total: 0 };
  }

  const placeholders = roomIds.map(() => "?").join(", ");
  const participation = await env.DB.prepare(
    `SELECT id, room_id, parent_id, created_at
     FROM messages
     WHERE project_id = ? AND user_id = ? AND deleted_at IS NULL
       AND room_id IN (${placeholders})
       AND (
         parent_id IS NOT NULL
         OR EXISTS (
           SELECT 1 FROM messages r
           WHERE r.parent_id = messages.id AND r.deleted_at IS NULL AND r.project_id = messages.project_id
         )
       )
     ORDER BY created_at DESC
     LIMIT ?`,
  )
    .bind(scope.projectId, scope.userId, ...roomIds, PARTICIPATION_LIMIT)
    .all();

  /** @type {Map<string, { roomId: string, rootId: number, sortAt: string }>} */
  const candidates = new Map();
  for (const row of participation.results || []) {
    const roomId = String(row.room_id);
    const messageId = Number(row.id);
    const rootId = row.parent_id
      ? await resolveThreadRootId(env, scope.projectId, roomId, messageId)
      : messageId;
    if (!rootId) continue;
    const key = `${roomId}:${rootId}`;
    const sortAt = String(row.created_at || "");
    const existing = candidates.get(key);
    if (!existing || sortAt > existing.sortAt) {
      candidates.set(key, { roomId, rootId, sortAt });
    }
  }

  const sorted = [...candidates.values()].sort((a, b) => b.sortAt.localeCompare(a.sortAt));
  const threads = [];

  for (const candidate of sorted) {
    if (threads.length >= limit && !scope.unreadOnly) break;
    const item = await buildThreadListItem(env, {
      projectId: scope.projectId,
      roomId: candidate.roomId,
      rootId: candidate.rootId,
      userId: scope.userId,
    });
    if (!item) continue;
    if (scope.unreadOnly && item.unreadCount <= 0) continue;
    threads.push(item);
    if (threads.length >= limit) break;
  }

  threads.sort((a, b) => b.lastReply.createdAt.localeCompare(a.lastReply.createdAt));

  return { threads, total: threads.length };
}
