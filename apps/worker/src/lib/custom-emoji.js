/**
 * Project custom emoji registry (Slack/Mattermost-style).
 * Custom emoji are rendered from `:name:` tokens; the image is an https URL.
 */

export const CUSTOM_EMOJI_NAME_RE = /^[a-z0-9_]{2,32}$/;
export const CUSTOM_EMOJI_MAX = 200;

export function normalizeCustomEmojiName(name) {
  return String(name || "")
    .trim()
    .replace(/^:|:$/g, "")
    .toLowerCase();
}

export function isValidCustomEmojiName(name) {
  return CUSTOM_EMOJI_NAME_RE.test(String(name || ""));
}

export function isValidCustomEmojiUrl(url) {
  const raw = String(url || "").trim();
  if (!raw || raw.length > 600) return false;
  return /^https:\/\//i.test(raw);
}

export function customEmojiToken(name) {
  return `:${normalizeCustomEmojiName(name)}:`;
}

export async function createCustomEmoji(env, { projectId, name, imageUrl, createdBy = null }) {
  if (!projectId) return { ok: false, error: "invalid_project" };
  const normalized = normalizeCustomEmojiName(name);
  if (!isValidCustomEmojiName(normalized)) {
    return { ok: false, error: "invalid_emoji_name" };
  }
  if (!isValidCustomEmojiUrl(imageUrl)) {
    return { ok: false, error: "invalid_emoji_url" };
  }
  const existing = await env.DB.prepare(
    "SELECT id FROM custom_emojis WHERE project_id = ? AND name = ? LIMIT 1",
  )
    .bind(projectId, normalized)
    .first();
  if (existing) return { ok: false, error: "emoji_exists", status: 409 };
  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM custom_emojis WHERE project_id = ?",
  )
    .bind(projectId)
    .first();
  if (Number(count?.c || 0) >= CUSTOM_EMOJI_MAX) {
    return { ok: false, error: "emoji_limit" };
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const url = String(imageUrl).trim();
  await env.DB.prepare(
    "INSERT INTO custom_emojis (id, project_id, name, image_url, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(id, projectId, normalized, url, createdBy, now)
    .run();
  return {
    ok: true,
    emoji: { id, name: normalized, imageUrl: url, createdBy, createdAt: now },
  };
}

export async function listCustomEmojis(env, { projectId }) {
  if (!projectId) return { emojis: [] };
  const rows = await env.DB.prepare(
    "SELECT id, name, image_url, created_by, created_at FROM custom_emojis WHERE project_id = ? ORDER BY name ASC LIMIT ?",
  )
    .bind(projectId, CUSTOM_EMOJI_MAX)
    .all();
  return {
    emojis: (rows.results || []).map((row) => ({
      id: row.id,
      name: row.name,
      imageUrl: row.image_url,
      createdBy: row.created_by,
      createdAt: row.created_at,
    })),
  };
}

export async function deleteCustomEmoji(env, { projectId, id }) {
  if (!projectId || !id) return { ok: false, error: "invalid_emoji" };
  const existing = await env.DB.prepare(
    "SELECT id FROM custom_emojis WHERE id = ? AND project_id = ? LIMIT 1",
  )
    .bind(id, projectId)
    .first();
  if (!existing) return { ok: false, error: "emoji_not_found", status: 404 };
  await env.DB.prepare("DELETE FROM custom_emojis WHERE id = ? AND project_id = ?")
    .bind(id, projectId)
    .run();
  return { ok: true };
}
