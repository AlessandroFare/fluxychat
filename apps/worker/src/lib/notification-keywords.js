/**
 * Personal notification keywords (Mattermost/Slack "keyword alerts").
 * A message containing one of a user's keywords notifies that user, on top of
 * mentions. Matching is word-boundary based and case-insensitive.
 */

export const NOTIFICATION_KEYWORD_MAX = 25;
export const NOTIFICATION_KEYWORD_LEN_MAX = 40;

export function normalizeNotificationKeyword(word) {
  return String(word || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, NOTIFICATION_KEYWORD_LEN_MAX);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function keywordMatchesContent(content, word) {
  const normalized = normalizeNotificationKeyword(word);
  if (!normalized || !content) return false;
  const re = new RegExp(
    `(^|[^\\p{L}\\p{N}_])${escapeRegExp(normalized)}([^\\p{L}\\p{N}_]|$)`,
    "iu",
  );
  return re.test(String(content));
}

export async function addNotificationKeyword(env, { projectId, userId, word }) {
  if (!projectId || !userId) return { ok: false, error: "invalid_keyword" };
  const normalized = normalizeNotificationKeyword(word);
  if (!normalized) return { ok: false, error: "invalid_keyword" };
  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM user_notification_keywords WHERE project_id = ? AND user_id = ?",
  )
    .bind(projectId, userId)
    .first();
  if (Number(count?.c || 0) >= NOTIFICATION_KEYWORD_MAX) {
    return { ok: false, error: "keyword_limit" };
  }
  await env.DB.prepare(
    "INSERT OR IGNORE INTO user_notification_keywords (id, project_id, user_id, word, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(crypto.randomUUID(), projectId, userId, normalized, new Date().toISOString())
    .run();
  return { ok: true, keyword: normalized };
}

export async function removeNotificationKeyword(env, { projectId, userId, word }) {
  if (!projectId || !userId) return { ok: false, error: "invalid_keyword" };
  const normalized = normalizeNotificationKeyword(word);
  if (!normalized) return { ok: false, error: "invalid_keyword" };
  await env.DB.prepare(
    "DELETE FROM user_notification_keywords WHERE project_id = ? AND user_id = ? AND word = ?",
  )
    .bind(projectId, userId, normalized)
    .run();
  return { ok: true, keyword: normalized };
}

export async function listNotificationKeywords(env, { projectId, userId }) {
  if (!projectId || !userId) return { keywords: [] };
  const rows = await env.DB.prepare(
    "SELECT word, created_at FROM user_notification_keywords WHERE project_id = ? AND user_id = ? ORDER BY word ASC",
  )
    .bind(projectId, userId)
    .all();
  return {
    keywords: (rows.results || []).map((row) => ({
      word: row.word,
      createdAt: row.created_at,
    })),
  };
}

/**
 * @param {*} env
 * @param {{ projectId: string, content: string, excludeUserId?: string, memberIds?: string[] }} input
 */
export async function matchNotificationKeywordUsers(env, input) {
  const members = new Set((input.memberIds || []).filter(Boolean));
  if (!env?.DB || !input.projectId || !input.content || !members.size) return [];
  const rows = await env.DB.prepare(
    "SELECT user_id, word FROM user_notification_keywords WHERE project_id = ? LIMIT 500",
  )
    .bind(input.projectId)
    .all();
  const hits = new Set();
  for (const row of rows.results || []) {
    if (!members.has(row.user_id) || row.user_id === input.excludeUserId) continue;
    if (keywordMatchesContent(input.content, row.word)) hits.add(row.user_id);
  }
  return [...hits];
}
