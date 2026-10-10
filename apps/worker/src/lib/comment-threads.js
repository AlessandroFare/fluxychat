/**
 * Contextual comment threads (LB-THRD / LB-CMT) — not chat parent_id replies.
 */
import { fanoutServerEvent } from "./message-realtime-fanout.js";

const METADATA_MAX = 1024;
const BODY_MAX = 4000;
const QUOTE_MAX = 500;

export function sanitizeCommentMetadata(raw) {
  if (raw == null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const key of ["x", "y"]) {
    if (raw[key] != null) {
      const n = Number(raw[key]);
      if (Number.isFinite(n)) out[key] = Math.max(-1e6, Math.min(1e6, n));
    }
  }
  if (typeof raw.sceneId === "string") out.sceneId = raw.sceneId.slice(0, 64);
  if (typeof raw.quote === "string") out.quote = raw.quote.slice(0, QUOTE_MAX);
  const encoded = JSON.stringify(out);
  if (encoded.length > METADATA_MAX) return {};
  return out;
}

function parseMetadata(raw) {
  if (raw && typeof raw === "object") return raw;
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function mapThread(row, comments = []) {
  return {
    id: row.id,
    roomId: row.room_id,
    createdBy: row.created_by,
    metadata: parseMetadata(row.metadata),
    resolved: Number(row.resolved) === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    comments,
  };
}

const EMOJI_MAX = 32;

export function parseCommentReactions(raw) {
  const parsed = parseMetadata(typeof raw === "string" ? raw : JSON.stringify(raw || {}));
  const out = {};
  for (const [emoji, users] of Object.entries(parsed)) {
    if (!Array.isArray(users)) continue;
    const ids = users.map((id) => String(id)).filter(Boolean).slice(0, 64);
    if (ids.length) out[String(emoji).slice(0, EMOJI_MAX)] = ids;
  }
  return out;
}

function mapComment(row) {
  return {
    id: row.id,
    threadId: row.thread_id,
    userId: row.user_id,
    body: row.body,
    createdAt: row.created_at,
    editedAt: row.edited_at ?? null,
    reactions: parseCommentReactions(row.reactions_json),
  };
}

export async function listCommentThreads(env, { projectId, roomId }) {
  const threadRows = await env.DB.prepare(
    `SELECT id, project_id, room_id, created_by, metadata, resolved, created_at, updated_at
     FROM room_comment_threads
     WHERE project_id = ? AND room_id = ?
     ORDER BY created_at ASC`,
  )
    .bind(projectId, roomId)
    .all();
  const threads = threadRows.results || [];
  if (threads.length === 0) return [];

  const commentRows = await env.DB.prepare(
    `SELECT id, thread_id, user_id, body, created_at, edited_at, reactions_json
     FROM room_comment_thread_comments
     WHERE project_id = ? AND room_id = ?
     ORDER BY created_at ASC`,
  )
    .bind(projectId, roomId)
    .all();
  const byThread = new Map();
  for (const row of commentRows.results || []) {
    const list = byThread.get(row.thread_id) || [];
    list.push(mapComment(row));
    byThread.set(row.thread_id, list);
  }
  return threads.map((row) => mapThread(row, byThread.get(row.id) || []));
}

export async function createCommentThread(env, { projectId, roomId, userId, body, metadata }) {
  const text = String(body || "").trim().slice(0, BODY_MAX);
  if (!text) return { ok: false, error: "body_required" };
  const meta = sanitizeCommentMetadata(metadata);
  const id = `cth_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const commentId = `cmt_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO room_comment_threads
      (id, project_id, room_id, created_by, metadata, resolved, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
  )
    .bind(id, projectId, roomId, userId, JSON.stringify(meta), now, now)
    .run();

  await env.DB.prepare(
    `INSERT INTO room_comment_thread_comments
      (id, thread_id, project_id, room_id, user_id, body, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(commentId, id, projectId, roomId, userId, text, now)
    .run();

  const thread = {
    id,
    roomId,
    createdBy: userId,
    metadata: meta,
    resolved: false,
    createdAt: now,
    updatedAt: now,
    comments: [
      {
        id: commentId,
        threadId: id,
        userId,
        body: text,
        createdAt: now,
        editedAt: null,
        reactions: {},
      },
    ],
  };

  await fanoutServerEvent(env, {
    projectId,
    roomId,
    name: "comment.thread",
    data: thread,
    userId,
  }).catch(() => {});

  return { ok: true, thread };
}

export async function addCommentToThread(env, { projectId, roomId, threadId, userId, body }) {
  const text = String(body || "").trim().slice(0, BODY_MAX);
  if (!text) return { ok: false, error: "body_required" };
  const thread = await env.DB.prepare(
    `SELECT id FROM room_comment_threads WHERE id = ? AND project_id = ? AND room_id = ? LIMIT 1`,
  )
    .bind(threadId, projectId, roomId)
    .first();
  if (!thread) return { ok: false, error: "thread_not_found" };

  const id = `cmt_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO room_comment_thread_comments
      (id, thread_id, project_id, room_id, user_id, body, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, threadId, projectId, roomId, userId, text, now)
    .run();
  await env.DB.prepare(
    `UPDATE room_comment_threads SET updated_at = ? WHERE id = ?`,
  )
    .bind(now, threadId)
    .run();

  const comment = {
    id,
    threadId,
    userId,
    body: text,
    createdAt: now,
    editedAt: null,
    reactions: {},
  };

  await fanoutServerEvent(env, {
    projectId,
    roomId,
    name: "comment.created",
    data: comment,
    userId,
  }).catch(() => {});

  return { ok: true, comment };
}

export async function updateCommentThread(env, { projectId, roomId, threadId, resolved, metadata }) {
  const row = await env.DB.prepare(
    `SELECT id, metadata FROM room_comment_threads WHERE id = ? AND project_id = ? AND room_id = ? LIMIT 1`,
  )
    .bind(threadId, projectId, roomId)
    .first();
  if (!row) return { ok: false, error: "thread_not_found" };

  const now = new Date().toISOString();
  const nextMeta =
    metadata !== undefined ? sanitizeCommentMetadata(metadata) : parseMetadata(row.metadata);
  const nextResolved = resolved === undefined ? null : resolved ? 1 : 0;

  if (nextResolved == null) {
    await env.DB.prepare(
      `UPDATE room_comment_threads SET metadata = ?, updated_at = ? WHERE id = ?`,
    )
      .bind(JSON.stringify(nextMeta), now, threadId)
      .run();
  } else {
    await env.DB.prepare(
      `UPDATE room_comment_threads SET metadata = ?, resolved = ?, updated_at = ? WHERE id = ?`,
    )
      .bind(JSON.stringify(nextMeta), nextResolved, now, threadId)
      .run();
  }

  await fanoutServerEvent(env, {
    projectId,
    roomId,
    name: "comment.thread.updated",
    data: { id: threadId, resolved: nextResolved == null ? undefined : nextResolved === 1, metadata: nextMeta },
    userId: "system",
  }).catch(() => {});

  return { ok: true };
}

export async function deleteCommentThread(env, { projectId, roomId, threadId, userId }) {
  const row = await env.DB.prepare(
    `SELECT id, created_by FROM room_comment_threads WHERE id = ? AND project_id = ? AND room_id = ? LIMIT 1`,
  )
    .bind(threadId, projectId, roomId)
    .first();
  if (!row) return { ok: false, error: "thread_not_found" };
  if (String(row.created_by) !== String(userId)) return { ok: false, error: "forbidden" };

  await env.DB.prepare(
    `DELETE FROM room_comment_thread_comments WHERE thread_id = ? AND project_id = ? AND room_id = ?`,
  )
    .bind(threadId, projectId, roomId)
    .run();
  await env.DB.prepare(
    `DELETE FROM room_comment_threads WHERE id = ? AND project_id = ? AND room_id = ?`,
  )
    .bind(threadId, projectId, roomId)
    .run();

  await fanoutServerEvent(env, {
    projectId,
    roomId,
    name: "comment.thread.deleted",
    data: { id: threadId },
    userId,
  }).catch(() => {});

  return { ok: true };
}

export async function editComment(env, { projectId, roomId, threadId, commentId, userId, body }) {
  const text = String(body || "").trim().slice(0, BODY_MAX);
  if (!text) return { ok: false, error: "body_required" };
  const row = await env.DB.prepare(
    `SELECT id, thread_id, user_id, body, created_at FROM room_comment_thread_comments
     WHERE id = ? AND thread_id = ? AND project_id = ? AND room_id = ? LIMIT 1`,
  )
    .bind(commentId, threadId, projectId, roomId)
    .first();
  if (!row) return { ok: false, error: "comment_not_found" };
  if (String(row.user_id) !== String(userId)) return { ok: false, error: "forbidden" };

  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE room_comment_thread_comments SET body = ?, edited_at = ? WHERE id = ?`,
  )
    .bind(text, now, commentId)
    .run();
  await env.DB.prepare(
    `UPDATE room_comment_threads SET updated_at = ? WHERE id = ?`,
  )
    .bind(now, threadId)
    .run();

  const comment = {
    id: commentId,
    threadId,
    userId,
    body: text,
    createdAt: row.created_at ?? now,
    editedAt: now,
    reactions: parseCommentReactions(row.reactions_json),
  };

  await fanoutServerEvent(env, {
    projectId,
    roomId,
    name: "comment.updated",
    data: comment,
    userId,
  }).catch(() => {});

  return { ok: true, comment };
}

export async function deleteComment(env, { projectId, roomId, threadId, commentId, userId }) {
  const row = await env.DB.prepare(
    `SELECT id, thread_id, user_id FROM room_comment_thread_comments
     WHERE id = ? AND thread_id = ? AND project_id = ? AND room_id = ? LIMIT 1`,
  )
    .bind(commentId, threadId, projectId, roomId)
    .first();
  if (!row) return { ok: false, error: "comment_not_found" };
  if (String(row.user_id) !== String(userId)) return { ok: false, error: "forbidden" };

  await env.DB.prepare(
    `DELETE FROM room_comment_thread_comments WHERE id = ? AND project_id = ? AND room_id = ?`,
  )
    .bind(commentId, projectId, roomId)
    .run();
  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE room_comment_threads SET updated_at = ? WHERE id = ?`,
  )
    .bind(now, threadId)
    .run();

  await fanoutServerEvent(env, {
    projectId,
    roomId,
    name: "comment.deleted",
    data: { id: commentId, threadId },
    userId,
  }).catch(() => {});

  return { ok: true };
}

export async function setCommentReaction(env, { projectId, roomId, threadId, commentId, userId, emoji, remove }) {
  const mark = String(emoji || "").trim().slice(0, EMOJI_MAX);
  if (!mark) return { ok: false, error: "emoji_required" };
  const row = await env.DB.prepare(
    `SELECT id, thread_id, user_id, body, created_at, edited_at, reactions_json
     FROM room_comment_thread_comments
     WHERE id = ? AND thread_id = ? AND project_id = ? AND room_id = ? LIMIT 1`,
  )
    .bind(commentId, threadId, projectId, roomId)
    .first();
  if (!row) return { ok: false, error: "comment_not_found" };

  const reactions = parseCommentReactions(row.reactions_json);
  const users = new Set(reactions[mark] || []);
  if (remove) users.delete(String(userId));
  else users.add(String(userId));
  if (users.size) reactions[mark] = [...users];
  else delete reactions[mark];

  await env.DB.prepare(
    `UPDATE room_comment_thread_comments SET reactions_json = ? WHERE id = ?`,
  )
    .bind(JSON.stringify(reactions), commentId)
    .run();

  const comment = mapComment({ ...row, reactions_json: JSON.stringify(reactions) });
  await fanoutServerEvent(env, {
    projectId,
    roomId,
    name: "comment.reaction",
    data: { commentId, threadId, emoji: mark, userId, remove: Boolean(remove), reactions },
    userId,
  }).catch(() => {});
  return { ok: true, comment };
}
