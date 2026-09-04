/**
 * NW-106 — list reply threads the user participates in.
 */
import { collectThreadMessages } from "./thread-summary.js";

export const MAX_CHAT_THREAD_DEPTH = 8;

function encodeRoomThreadCursor(lastReplyAt, threadId) {
  const json = JSON.stringify({ t: String(lastReplyAt), id: Number(threadId) });
  if (typeof btoa === "function") return btoa(json);
  return Buffer.from(json, "utf8").toString("base64");
}

function decodeRoomThreadCursor(raw) {
  try {
    const json =
      typeof atob === "function"
        ? atob(String(raw))
        : Buffer.from(String(raw), "base64").toString("utf8");
    const parsed = JSON.parse(json);
    if (typeof parsed.t !== "string" || !Number.isFinite(Number(parsed.id))) return null;
    return { t: parsed.t, id: Number(parsed.id) };
  } catch {
    return null;
  }
}

export function parseReplyParentId(body) {
  const raw = body?.replyTo ?? body?.parentId ?? body?.threadParentId;
  if (raw == null || raw === "") return null;
  const id = Number(raw);
  if (!Number.isFinite(id) || id < 1) return null;
  return Math.floor(id);
}

/**
 * @param {*} env
 * @param {{ projectId: string, roomId: string, parentId: number }} input
 */
export async function assertChatThreadDepth(env, input) {
  let currentId = input.parentId;
  let hops = 0;
  for (let i = 0; i < MAX_CHAT_THREAD_DEPTH + 2; i++) {
    const row = await env.DB.prepare(
      `SELECT id, parent_id FROM messages
       WHERE project_id = ? AND room_id = ? AND id = ? AND deleted_at IS NULL
       LIMIT 1`,
    )
      .bind(input.projectId, input.roomId, currentId)
      .first();
    if (!row) return { ok: false, error: "parent_not_found" };
    if (!row.parent_id) {
      if (hops >= MAX_CHAT_THREAD_DEPTH) {
        return { ok: false, error: "thread_depth_exceeded" };
      }
      return { ok: true };
    }
    hops += 1;
    if (hops >= MAX_CHAT_THREAD_DEPTH) {
      return { ok: false, error: "thread_depth_exceeded" };
    }
    currentId = Number(row.parent_id);
  }
  return { ok: false, error: "thread_depth_exceeded" };
}

function compareThreadDesc(a, b) {
  const t = String(b.lastReplyAt).localeCompare(String(a.lastReplyAt));
  if (t !== 0) return t;
  return b.id - a.id;
}

/**
 * Portal-style room thread registry. Thread id = parent message id.
 *
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   roomId: string,
 *   parent?: string | number | null,
 *   root?: string | number | null,
 *   cursor?: string | null,
 *   limit?: number,
 * }} query
 */
export async function listRoomThreads(env, query) {
  const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
  const parents = await env.DB.prepare(
    `SELECT m.id, m.parent_id, m.user_id, m.content, m.created_at
     FROM messages m
     WHERE m.project_id = ? AND m.room_id = ? AND m.deleted_at IS NULL
       AND EXISTS (
         SELECT 1 FROM messages r
         WHERE r.parent_id = m.id AND r.project_id = m.project_id
           AND r.room_id = m.room_id AND r.deleted_at IS NULL
       )`,
  )
    .bind(query.projectId, query.roomId)
    .all();

  const agg = await env.DB.prepare(
    `SELECT parent_id, COUNT(*) AS reply_count, MAX(created_at) AS last_reply_at, MAX(id) AS last_reply_id
     FROM messages
     WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL AND parent_id IS NOT NULL
     GROUP BY parent_id`,
  )
    .bind(query.projectId, query.roomId)
    .all();

  const aggMap = new Map();
  for (const row of agg.results || []) {
    aggMap.set(Number(row.parent_id), {
      replyCount: Number(row.reply_count) || 0,
      lastReplyAt: String(row.last_reply_at || ""),
      lastReplyId: Number(row.last_reply_id),
    });
  }

  const parentFilter =
    query.parent === undefined || query.parent === null || query.parent === ""
      ? "root"
      : Number(query.parent);
  const rootFilter =
    query.root != null && query.root !== "" ? Number(query.root) : null;

  if (parentFilter !== "root" && !Number.isFinite(parentFilter)) {
    return { ok: false, error: "invalid_parent" };
  }
  if (rootFilter != null && !Number.isFinite(rootFilter)) {
    return { ok: false, error: "invalid_root" };
  }

  let decoded = null;
  if (query.cursor) {
    decoded = decodeRoomThreadCursor(query.cursor);
    if (!decoded) return { ok: false, error: "invalid_cursor" };
  }

  const items = [];
  for (const row of parents.results || []) {
    const id = Number(row.id);
    const parentId = row.parent_id == null ? null : Number(row.parent_id);
    const stats = aggMap.get(id);
    if (!stats) continue;

    if (parentFilter === "root") {
      if (parentId != null) continue;
    } else if (parentId !== parentFilter) {
      continue;
    }

    const rootId = parentId
      ? await resolveThreadRootId(env, query.projectId, query.roomId, id)
      : id;
    if (!rootId) continue;
    if (rootFilter != null && rootId !== rootFilter) continue;

    let depth = 0;
    if (parentId) {
      let walk = parentId;
      for (let i = 0; i < 20 && walk; i++) {
        depth += 1;
        const p = await env.DB.prepare(
          `SELECT id, parent_id FROM messages
           WHERE project_id = ? AND room_id = ? AND id = ? AND deleted_at IS NULL
           LIMIT 1`,
        )
          .bind(query.projectId, query.roomId, walk)
          .first();
        if (!p || !p.parent_id) break;
        walk = Number(p.parent_id);
      }
    }

    items.push({
      id,
      roomId: query.roomId,
      parentThreadId: parentId,
      rootThreadId: rootId,
      depth,
      spawnedBy: { id: String(row.user_id) },
      messageCount: stats.replyCount,
      createdAt: String(row.created_at || ""),
      lastReplyAt: stats.lastReplyAt,
      lastReplyMessageId: stats.lastReplyId,
      preview: previewContent(row.content),
    });
  }

  items.sort(compareThreadDesc);

  let start = 0;
  if (decoded) {
    start = items.findIndex(
      (t) =>
        t.lastReplyAt < decoded.t ||
        (t.lastReplyAt === decoded.t && t.id < decoded.id),
    );
    if (start < 0) start = items.length;
  }

  const slice = items.slice(start, start + limit);
  const rest = items.slice(start + limit);
  const hasMore = rest.length > 0;
  const last = slice[slice.length - 1];
  const nextCursor =
    hasMore && last ? encodeRoomThreadCursor(last.lastReplyAt, last.id) : null;

  return {
    ok: true,
    threads: slice,
    hasMore,
    nextCursor,
  };
}

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
