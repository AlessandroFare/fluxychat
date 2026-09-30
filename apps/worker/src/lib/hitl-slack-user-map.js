import { isValidId } from "./valid-ids.js";

const SLACK_USER_ID_RE = /^[UW][A-Z0-9]{6,31}$/i;

export function isValidSlackUserId(id) {
  return typeof id === "string" && SLACK_USER_ID_RE.test(id.trim());
}

export function normalizeSlackUserId(id) {
  return String(id || "").trim();
}

export async function getFluxyUserIdForSlackUser(env, projectId, slackUserId) {
  if (!env?.DB || !isValidId(projectId) || !isValidSlackUserId(slackUserId)) return null;
  const row = await env.DB.prepare(
    `SELECT fluxy_user_id FROM hitl_slack_user_map WHERE project_id = ? AND slack_user_id = ?`,
  )
    .bind(projectId, normalizeSlackUserId(slackUserId))
    .first()
    .catch(() => null);
  const uid = row?.fluxy_user_id;
  return typeof uid === "string" && isValidId(uid) ? uid : null;
}

export async function getSlackUserIdForFluxyUser(env, projectId, fluxyUserId) {
  if (!env?.DB || !isValidId(projectId) || !isValidId(fluxyUserId)) return null;
  const row = await env.DB.prepare(
    `SELECT slack_user_id FROM hitl_slack_user_map WHERE project_id = ? AND fluxy_user_id = ? LIMIT 1`,
  )
    .bind(projectId, fluxyUserId)
    .first()
    .catch(() => null);
  const sid = row?.slack_user_id;
  return isValidSlackUserId(sid) ? normalizeSlackUserId(sid) : null;
}

export async function listHitlSlackUserMap(env, projectId, { onlyUserId } = {}) {
  if (!env?.DB || !isValidId(projectId)) return [];
  const sql = onlyUserId
    ? `SELECT slack_user_id, fluxy_user_id, updated_at FROM hitl_slack_user_map
       WHERE project_id = ? AND fluxy_user_id = ? ORDER BY slack_user_id`
    : `SELECT slack_user_id, fluxy_user_id, updated_at FROM hitl_slack_user_map
       WHERE project_id = ? ORDER BY slack_user_id`;
  const stmt = onlyUserId
    ? env.DB.prepare(sql).bind(projectId, onlyUserId)
    : env.DB.prepare(sql).bind(projectId);
  const { results } = await stmt.all().catch(() => ({ results: [] }));
  return (results || []).map((row) => ({
    slackUserId: row.slack_user_id,
    fluxyUserId: row.fluxy_user_id,
    updatedAt: row.updated_at ?? null,
  }));
}

export async function upsertHitlSlackUserMap(env, projectId, slackUserId, fluxyUserId) {
  if (!env?.DB || !isValidId(projectId) || !isValidSlackUserId(slackUserId) || !isValidId(fluxyUserId)) {
    return null;
  }
  const now = new Date().toISOString();
  const sid = normalizeSlackUserId(slackUserId);
  await env.DB.prepare(
    `INSERT INTO hitl_slack_user_map (project_id, slack_user_id, fluxy_user_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(project_id, slack_user_id) DO UPDATE SET
       fluxy_user_id = excluded.fluxy_user_id,
       updated_at = excluded.updated_at`,
  )
    .bind(projectId, sid, fluxyUserId, now, now)
    .run();
  return { slackUserId: sid, fluxyUserId, updatedAt: now };
}

export async function deleteHitlSlackUserMap(env, projectId, slackUserId) {
  if (!env?.DB || !isValidId(projectId) || !isValidSlackUserId(slackUserId)) return false;
  await env.DB.prepare(
    `DELETE FROM hitl_slack_user_map WHERE project_id = ? AND slack_user_id = ?`,
  )
    .bind(projectId, normalizeSlackUserId(slackUserId))
    .run();
  return true;
}
