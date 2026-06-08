/**
 * Timezone-aware quiet hours (P12-N).
 */

const HM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * @param {*} env
 */
export function isQuietHoursGloballyEnabled(env) {
  return env.QUIET_HOURS_ENABLED !== "false" && env.QUIET_HOURS_ENABLED !== "0";
}

/**
 * @param {string} raw
 */
export function isValidTimezone(raw) {
  const tz = String(raw || "").trim();
  if (!tz || tz.length > 64) return false;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} raw
 */
export function parseHm(raw) {
  const match = HM_RE.exec(String(raw || "").trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * @param {Date} date
 * @param {string} timeZone
 */
export function getLocalMinutesSinceMidnight(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

/**
 * @param {{
 *   enabled?: boolean,
 *   quietStart?: string,
 *   quietEnd?: string,
 *   timezone?: string,
 * }} prefs
 * @param {Date} [now]
 */
export function isInQuietHours(prefs, now = new Date()) {
  if (!prefs?.enabled) return false;
  const tz = prefs.timezone || "UTC";
  const start = parseHm(prefs.quietStart ?? "22:00");
  const end = parseHm(prefs.quietEnd ?? "07:00");
  if (start == null || end == null) return false;
  if (start === end) return false;

  const localMin = getLocalMinutesSinceMidnight(now, tz);
  if (start < end) {
    return localMin >= start && localMin < end;
  }
  return localMin >= start || localMin < end;
}

/**
 * @param {*} row
 */
export function mapQuietHoursRow(row) {
  if (!row) {
    return {
      enabled: false,
      timezone: "UTC",
      quietStart: "22:00",
      quietEnd: "07:00",
      batchPush: true,
      batchInApp: true,
      updatedAt: null,
    };
  }
  return {
    enabled: row.enabled === 1,
    timezone: row.timezone || "UTC",
    quietStart: row.quiet_start || "22:00",
    quietEnd: row.quiet_end || "07:00",
    batchPush: row.batch_push !== 0,
    batchInApp: row.batch_in_app !== 0,
    updatedAt: row.updated_at ?? null,
  };
}

/**
 * @param {*} env
 * @param {string} projectId
 * @param {string} userId
 */
export async function getQuietHoursPreferences(env, projectId, userId) {
  const row = await env.DB.prepare(
    `SELECT enabled, timezone, quiet_start, quiet_end, batch_push, batch_in_app, updated_at
     FROM user_quiet_hours
     WHERE project_id = ? AND user_id = ?`,
  )
    .bind(projectId, userId)
    .first();
  return mapQuietHoursRow(row);
}

/**
 * @param {*} env
 * @param {string} projectId
 * @param {string} userId
 * @param {{
 *   enabled?: boolean,
 *   timezone?: string,
 *   quietStart?: string,
 *   quietEnd?: string,
 *   batchPush?: boolean,
 *   batchInApp?: boolean,
 * }} patch
 */
export async function upsertQuietHoursPreferences(env, projectId, userId, patch) {
  const existing = await getQuietHoursPreferences(env, projectId, userId);

  const timezone =
    patch.timezone !== undefined
      ? String(patch.timezone).trim()
      : existing.timezone;
  if (!isValidTimezone(timezone)) {
    return { ok: false, error: "invalid_timezone" };
  }

  const quietStart =
    patch.quietStart !== undefined ? String(patch.quietStart).trim() : existing.quietStart;
  const quietEnd =
    patch.quietEnd !== undefined ? String(patch.quietEnd).trim() : existing.quietEnd;
  if (parseHm(quietStart) == null || parseHm(quietEnd) == null) {
    return { ok: false, error: "invalid_time_range" };
  }

  const enabled =
    patch.enabled !== undefined ? Boolean(patch.enabled) : existing.enabled;
  const batchPush =
    patch.batchPush !== undefined ? Boolean(patch.batchPush) : existing.batchPush;
  const batchInApp =
    patch.batchInApp !== undefined ? Boolean(patch.batchInApp) : existing.batchInApp;
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO user_quiet_hours
       (project_id, user_id, enabled, timezone, quiet_start, quiet_end, batch_push, batch_in_app, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, user_id) DO UPDATE SET
       enabled = excluded.enabled,
       timezone = excluded.timezone,
       quiet_start = excluded.quiet_start,
       quiet_end = excluded.quiet_end,
       batch_push = excluded.batch_push,
       batch_in_app = excluded.batch_in_app,
       updated_at = excluded.updated_at`,
  )
    .bind(
      projectId,
      userId,
      enabled ? 1 : 0,
      timezone,
      quietStart,
      quietEnd,
      batchPush ? 1 : 0,
      batchInApp ? 1 : 0,
      now,
    )
    .run();

  return {
    ok: true,
    preferences: {
      enabled,
      timezone,
      quietStart,
      quietEnd,
      batchPush,
      batchInApp,
      updatedAt: now,
    },
  };
}

/**
 * @param {*} env
 * @param {string} projectId
 * @param {string} userId
 * @param {"push" | "in_app"} channel
 */
export async function shouldBatchNotification(env, projectId, userId, channel) {
  if (!isQuietHoursGloballyEnabled(env)) return false;
  const prefs = await getQuietHoursPreferences(env, projectId, userId);
  if (!prefs.enabled || !isInQuietHours(prefs)) return false;
  if (channel === "push") return prefs.batchPush;
  if (channel === "in_app") return prefs.batchInApp;
  return false;
}
