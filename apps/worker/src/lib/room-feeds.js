/**
 * Room activity feeds (LB-FEED) — not the chat `messages` timeline.
 */
import { fanoutServerEvent } from "./message-realtime-fanout.js";

const NAME_MAX = 80;
const BODY_MAX = 4000;
const FEED_KINDS = new Set(["activity", "agent", "automation"]);

export function sanitizeFeedKind(raw) {
  const kind = String(raw || "activity").trim().toLowerCase();
  return FEED_KINDS.has(kind) ? kind : "activity";
}

export function sanitizeFeedMessageMetadata(raw) {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  if (typeof raw.source === "string") out.source = raw.source.slice(0, 64);
  if (typeof raw.agentId === "string") out.agentId = raw.agentId.slice(0, 64);
  if (typeof raw.status === "string") out.status = raw.status.slice(0, 32);
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

function mapFeed(row) {
  return {
    id: row.id,
    roomId: row.room_id,
    name: row.name,
    kind: row.kind,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row) {
  return {
    id: row.id,
    feedId: row.feed_id,
    roomId: row.room_id,
    userId: row.user_id,
    body: row.body,
    metadata: parseMetadata(row.metadata),
    createdAt: row.created_at,
  };
}

export async function listRoomFeeds(env, { projectId, roomId }) {
  const rows = await env.DB.prepare(
    `SELECT id, project_id, room_id, name, kind, created_by, created_at, updated_at
     FROM room_feeds
     WHERE project_id = ? AND room_id = ?
     ORDER BY created_at ASC`,
  )
    .bind(projectId, roomId)
    .all();
  return (rows.results || []).map(mapFeed);
}

export async function createRoomFeed(env, { projectId, roomId, userId, name, kind }) {
  const title = String(name || "").trim().slice(0, NAME_MAX);
  if (!title) return { ok: false, error: "name_required" };
  const feedKind = sanitizeFeedKind(kind);
  const id = `feed_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO room_feeds
      (id, project_id, room_id, name, kind, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, projectId, roomId, title, feedKind, userId, now, now)
    .run();
  const feed = mapFeed({
    id,
    room_id: roomId,
    name: title,
    kind: feedKind,
    created_by: userId,
    created_at: now,
    updated_at: now,
  });
  await fanoutServerEvent(env, {
    projectId,
    roomId,
    name: "feed.created",
    data: feed,
    userId,
  }).catch(() => {});
  return { ok: true, feed };
}

export async function listFeedMessages(env, { projectId, roomId, feedId }) {
  const feed = await env.DB.prepare(
    `SELECT id FROM room_feeds WHERE id = ? AND project_id = ? AND room_id = ? LIMIT 1`,
  )
    .bind(feedId, projectId, roomId)
    .first();
  if (!feed) return { ok: false, error: "feed_not_found" };
  const rows = await env.DB.prepare(
    `SELECT id, feed_id, project_id, room_id, user_id, body, metadata, created_at
     FROM room_feed_messages
     WHERE feed_id = ? AND project_id = ? AND room_id = ?
     ORDER BY created_at ASC`,
  )
    .bind(feedId, projectId, roomId)
    .all();
  return { ok: true, messages: (rows.results || []).map(mapMessage) };
}

export async function createFeedMessage(env, { projectId, roomId, feedId, userId, body, metadata }) {
  const text = String(body || "").trim().slice(0, BODY_MAX);
  if (!text) return { ok: false, error: "body_required" };
  const feed = await env.DB.prepare(
    `SELECT id FROM room_feeds WHERE id = ? AND project_id = ? AND room_id = ? LIMIT 1`,
  )
    .bind(feedId, projectId, roomId)
    .first();
  if (!feed) return { ok: false, error: "feed_not_found" };
  const id = `fmsg_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const now = new Date().toISOString();
  const meta = sanitizeFeedMessageMetadata(metadata);
  await env.DB.prepare(
    `INSERT INTO room_feed_messages
      (id, feed_id, project_id, room_id, user_id, body, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, feedId, projectId, roomId, userId, text, JSON.stringify(meta), now)
    .run();
  await env.DB.prepare(`UPDATE room_feeds SET updated_at = ? WHERE id = ?`)
    .bind(now, feedId)
    .run();
  const message = mapMessage({
    id,
    feed_id: feedId,
    room_id: roomId,
    user_id: userId,
    body: text,
    metadata: meta,
    created_at: now,
  });
  await fanoutServerEvent(env, {
    projectId,
    roomId,
    name: "feed.message",
    data: message,
    userId,
  }).catch(() => {});
  return { ok: true, message };
}
