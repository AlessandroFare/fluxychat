import { logError } from "./worker-log.js";

export const WATCHLIST_TARGET_TYPES = new Set(["room", "user"]);
export const MAX_WATCHLIST_TARGETS = 100;
export const MAX_WATCHLIST_FANOUT = 200;

/**
 * @param {unknown} type
 * @returns {type is 'room' | 'user'}
 */
export function isWatchlistTargetType(type) {
  return typeof type === "string" && WATCHLIST_TARGET_TYPES.has(type);
}

/**
 * @param {import("@cloudflare/workers-types").Env} env
 * @param {string} projectId
 * @param {string} userId
 * @returns {Promise<Array<{ type: string; targetId: string; createdAt: string }>>}
 */
export async function listUserWatchlist(env, projectId, userId) {
  const rows = await env.DB.prepare(
    `SELECT target_type, target_id, created_at
     FROM user_watchlist
     WHERE project_id = ? AND user_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
  )
    .bind(projectId, userId, MAX_WATCHLIST_TARGETS)
    .all();
  return (rows.results || []).map((r) => ({
    type: r.target_type,
    targetId: r.target_id,
    createdAt: r.created_at,
  }));
}

/**
 * @param {import("@cloudflare/workers-types").Env} env
 * @param {{ projectId: string; userId: string; type: string; targetId: string }} opts
 */
export async function addUserWatchlistTarget(env, { projectId, userId, type, targetId }) {
  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM user_watchlist WHERE project_id = ? AND user_id = ?`,
  )
    .bind(projectId, userId)
    .first();
  if (Number(countRow?.c ?? 0) >= MAX_WATCHLIST_TARGETS) {
    return { ok: false, error: "watchlist_limit_exceeded", max: MAX_WATCHLIST_TARGETS };
  }
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO user_watchlist (project_id, user_id, target_type, target_id, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(projectId, userId, type, targetId, now)
    .run();
  return { ok: true };
}

/**
 * @param {import("@cloudflare/workers-types").Env} env
 * @param {{ projectId: string; userId: string; type: string; targetId: string }} opts
 */
export async function removeUserWatchlistTarget(env, { projectId, userId, type, targetId }) {
  await env.DB.prepare(
    `DELETE FROM user_watchlist
     WHERE project_id = ? AND user_id = ? AND target_type = ? AND target_id = ?`,
  )
    .bind(projectId, userId, type, targetId)
    .run();
  return { ok: true };
}

function userDoId(env, projectId, userId) {
  return env.USER.idFromName(`${projectId}__${userId}`);
}

/**
 * Notify users watching a room (or user) via their user channel.
 * @param {import("@cloudflare/workers-types").Env} env
 * @param {{ projectId: string; targetType: 'room' | 'user'; targetId: string; event: Record<string, unknown>; excludeUserId?: string }} opts
 */
export async function fanoutWatchlistForTarget(env, {
  projectId,
  targetType,
  targetId,
  event,
  excludeUserId,
}) {
  if (!projectId || !targetId || !event) return { notified: 0 };

  const rows = await env.DB.prepare(
    `SELECT user_id FROM user_watchlist
     WHERE project_id = ? AND target_type = ? AND target_id = ?
     LIMIT ?`,
  )
    .bind(projectId, targetType, targetId, MAX_WATCHLIST_FANOUT)
    .all();

  const watcherIds = (rows.results || [])
    .map((r) => r.user_id)
    .filter((uid) => uid && uid !== excludeUserId);

  let notified = 0;
  await Promise.all(
    watcherIds.map(async (watcherId) => {
      try {
        const stub = env.USER.get(userDoId(env, projectId, watcherId));
        const res = await stub.fetch("https://internal/deliver", {
          method: "POST",
          body: JSON.stringify({
            userId: watcherId,
            name: "watchlist_event",
            data: {
              targetType,
              targetId,
              event,
              at: new Date().toISOString(),
            },
          }),
        });
        if (res.ok) notified += 1;
      } catch (err) {
        logError("watchlist.fanout_failed", err, { watcherId, targetType, targetId });
      }
    }),
  );
  return { notified };
}

/** Event types that trigger room watchlist fanout. */
export const WATCHLIST_ROOM_EVENT_TYPES = new Set([
  "message",
  "edit",
  "delete",
  "reaction",
  "member_joined",
  "member_left",
]);
