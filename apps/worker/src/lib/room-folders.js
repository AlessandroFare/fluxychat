/**
 * Per-user room folders (Mattermost channel categories / Slack sections).
 * A room belongs to at most one of the user's folders; empty folders still list.
 */

export const ROOM_FOLDER_MAX = 20;
export const ROOM_FOLDER_NAME_MAX = 40;

export function normalizeRoomFolderName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, ROOM_FOLDER_NAME_MAX);
}

export async function listRoomFolders(env, { projectId, userId }) {
  if (!projectId || !userId) return { folders: [] };
  const folders = await env.DB.prepare(
    "SELECT id, name, position, created_at FROM room_folders WHERE project_id = ? AND user_id = ? ORDER BY position ASC, created_at ASC LIMIT ?",
  )
    .bind(projectId, userId, ROOM_FOLDER_MAX)
    .all();
  const rows = folders.results || [];
  if (!rows.length) return { folders: [] };
  const items = await env.DB.prepare(
    `SELECT folder_id, room_id FROM room_folder_items
      WHERE project_id = ?
        AND folder_id IN (SELECT id FROM room_folders WHERE project_id = ? AND user_id = ?)
      ORDER BY created_at ASC`,
  )
    .bind(projectId, projectId, userId)
    .all();
  const byFolder = new Map();
  for (const item of items.results || []) {
    if (!byFolder.has(item.folder_id)) byFolder.set(item.folder_id, []);
    byFolder.get(item.folder_id).push(item.room_id);
  }
  return {
    folders: rows.map((folder) => ({
      id: folder.id,
      name: folder.name,
      position: Number(folder.position) || 0,
      roomIds: byFolder.get(folder.id) || [],
    })),
  };
}

export async function createRoomFolder(env, { projectId, userId, name }) {
  if (!projectId || !userId) return { ok: false, error: "invalid_folder" };
  const normalized = normalizeRoomFolderName(name);
  if (!normalized) return { ok: false, error: "invalid_folder_name" };
  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM room_folders WHERE project_id = ? AND user_id = ?",
  )
    .bind(projectId, userId)
    .first();
  const position = Number(count?.c || 0);
  if (position >= ROOM_FOLDER_MAX) {
    return { ok: false, error: "folder_limit" };
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO room_folders (id, project_id, user_id, name, position, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(id, projectId, userId, normalized, position, now)
    .run();
  return { ok: true, folder: { id, name: normalized, position, roomIds: [] } };
}

export async function renameRoomFolder(env, { projectId, userId, folderId, name }) {
  if (!projectId || !userId || !folderId) {
    return { ok: false, error: "invalid_folder" };
  }
  const normalized = normalizeRoomFolderName(name);
  if (!normalized) return { ok: false, error: "invalid_folder_name" };
  const existing = await env.DB.prepare(
    "SELECT id FROM room_folders WHERE id = ? AND project_id = ? AND user_id = ? LIMIT 1",
  )
    .bind(folderId, projectId, userId)
    .first();
  if (!existing) return { ok: false, error: "folder_not_found", status: 404 };
  await env.DB.prepare(
    "UPDATE room_folders SET name = ? WHERE id = ? AND project_id = ? AND user_id = ?",
  )
    .bind(normalized, folderId, projectId, userId)
    .run();
  return { ok: true, folder: { id: folderId, name: normalized } };
}

export async function deleteRoomFolder(env, { projectId, userId, folderId }) {
  if (!projectId || !userId || !folderId) {
    return { ok: false, error: "invalid_folder" };
  }
  const existing = await env.DB.prepare(
    "SELECT id FROM room_folders WHERE id = ? AND project_id = ? AND user_id = ? LIMIT 1",
  )
    .bind(folderId, projectId, userId)
    .first();
  if (!existing) return { ok: false, error: "folder_not_found", status: 404 };
  await env.DB.batch([
    env.DB.prepare(
      "DELETE FROM room_folder_items WHERE folder_id = ? AND project_id = ?",
    ).bind(folderId, projectId),
    env.DB.prepare(
      "DELETE FROM room_folders WHERE id = ? AND project_id = ? AND user_id = ?",
    ).bind(folderId, projectId, userId),
  ]);
  return { ok: true };
}

export async function setRoomFolderItem(env, { projectId, userId, folderId, roomId }) {
  if (!projectId || !userId || !folderId || !roomId) {
    return { ok: false, error: "invalid_folder_item" };
  }
  const folder = await env.DB.prepare(
    "SELECT id FROM room_folders WHERE id = ? AND project_id = ? AND user_id = ? LIMIT 1",
  )
    .bind(folderId, projectId, userId)
    .first();
  if (!folder) return { ok: false, error: "folder_not_found", status: 404 };
  const room = await env.DB.prepare(
    "SELECT id FROM rooms WHERE id = ? AND project_id = ? LIMIT 1",
  )
    .bind(roomId, projectId)
    .first();
  if (!room) return { ok: false, error: "room_not_found", status: 404 };
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `DELETE FROM room_folder_items
        WHERE project_id = ? AND room_id = ?
          AND folder_id IN (SELECT id FROM room_folders WHERE project_id = ? AND user_id = ?)`,
    ).bind(projectId, roomId, projectId, userId),
    env.DB.prepare(
      "INSERT OR REPLACE INTO room_folder_items (folder_id, project_id, room_id, created_at) VALUES (?, ?, ?, ?)",
    ).bind(folderId, projectId, roomId, now),
  ]);
  return { ok: true, folderId, roomId };
}

export async function removeRoomFolderItem(env, { projectId, userId, folderId, roomId }) {
  if (!projectId || !userId || !folderId || !roomId) {
    return { ok: false, error: "invalid_folder_item" };
  }
  const folder = await env.DB.prepare(
    "SELECT id FROM room_folders WHERE id = ? AND project_id = ? AND user_id = ? LIMIT 1",
  )
    .bind(folderId, projectId, userId)
    .first();
  if (!folder) return { ok: false, error: "folder_not_found", status: 404 };
  await env.DB.prepare(
    "DELETE FROM room_folder_items WHERE folder_id = ? AND project_id = ? AND room_id = ?",
  )
    .bind(folderId, projectId, roomId)
    .run();
  return { ok: true };
}
