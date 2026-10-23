/**
 * Channel bookmarks — shared links pinned to a room (Mattermost channel bookmarks).
 * Members can add; the author or an owner/admin can delete.
 */

export const ROOM_BOOKMARK_MAX = 30;
export const ROOM_BOOKMARK_LABEL_MAX = 80;

function normalizeLabel(label) {
  return String(label || "").trim().slice(0, ROOM_BOOKMARK_LABEL_MAX);
}

function normalizeUrl(url) {
  const raw = String(url || "").trim().slice(0, 600);
  if (!raw || !/^https?:\/\//i.test(raw)) return null;
  return raw;
}

export async function createRoomBookmark(env, { projectId, roomId, label, url, createdBy = null }) {
  if (!projectId || !roomId) return { ok: false, error: "invalid_bookmark" };
  const normalizedLabel = normalizeLabel(label);
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedLabel) return { ok: false, error: "label_required" };
  if (!normalizedUrl) return { ok: false, error: "invalid_bookmark_url" };
  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM room_bookmarks WHERE project_id = ? AND room_id = ?",
  )
    .bind(projectId, roomId)
    .first();
  const position = Number(count?.c || 0);
  if (position >= ROOM_BOOKMARK_MAX) {
    return { ok: false, error: "bookmark_limit" };
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO room_bookmarks (id, project_id, room_id, label, url, position, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(id, projectId, roomId, normalizedLabel, normalizedUrl, position, createdBy, now)
    .run();
  return {
    ok: true,
    bookmark: {
      id,
      roomId,
      label: normalizedLabel,
      url: normalizedUrl,
      position,
      createdBy,
      createdAt: now,
    },
  };
}

export async function listRoomBookmarks(env, { projectId, roomId }) {
  if (!projectId || !roomId) return { bookmarks: [] };
  const rows = await env.DB.prepare(
    "SELECT id, label, url, position, created_by, created_at FROM room_bookmarks WHERE project_id = ? AND room_id = ? ORDER BY position ASC, created_at ASC LIMIT ?",
  )
    .bind(projectId, roomId, ROOM_BOOKMARK_MAX)
    .all();
  return {
    bookmarks: (rows.results || []).map((row) => ({
      id: row.id,
      label: row.label,
      url: row.url,
      position: Number(row.position) || 0,
      createdBy: row.created_by,
      createdAt: row.created_at,
    })),
  };
}

export async function deleteRoomBookmark(env, {
  projectId,
  roomId,
  id,
  actorUserId,
  privileged = false,
}) {
  if (!projectId || !roomId || !id) {
    return { ok: false, error: "invalid_bookmark" };
  }
  const row = await env.DB.prepare(
    "SELECT id, created_by FROM room_bookmarks WHERE id = ? AND project_id = ? AND room_id = ? LIMIT 1",
  )
    .bind(id, projectId, roomId)
    .first();
  if (!row) return { ok: false, error: "bookmark_not_found", status: 404 };
  if (!privileged && row.created_by && row.created_by !== actorUserId) {
    return { ok: false, error: "forbidden", status: 403 };
  }
  await env.DB.prepare(
    "DELETE FROM room_bookmarks WHERE id = ? AND project_id = ? AND room_id = ?",
  )
    .bind(id, projectId, roomId)
    .run();
  return { ok: true };
}
