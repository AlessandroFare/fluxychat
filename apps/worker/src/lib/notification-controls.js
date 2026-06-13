/**
 * P17-H: Notification Controls Granular
 * Per-topic preferences, digest frequency, snooze rules, priority levels.
 */

const VALID_TOPICS = [
  "message", "mention", "reaction", "thread_reply", "handoff",
  "moderation", "queue_assignment", "escalation", "follow_up", "system",
];
const VALID_DIGEST = ["realtime", "hourly", "daily", "weekly", "never"];
const VALID_PRIORITY = ["low", "normal", "high", "urgent"];

/**
 * @param {string} topic
 */
export function isValidTopic(topic) {
  return VALID_TOPICS.includes(topic);
}

/* ── Per-Topic Preferences ── */

export async function getPreference(db, { projectId, userId, topic, roomId }) {
  const row = await db
    .prepare(
      `SELECT * FROM user_notification_preferences
       WHERE project_id = ? AND user_id = ? AND topic = ? AND ${roomId ? "room_id = ?" : "room_id IS NULL"}`,
    )
    .bind(projectId, userId, topic, ...(roomId ? [roomId] : []))
    .first();
  return row ? mapPrefRow(row) : null;
}

export async function listPreferences(db, { projectId, userId }) {
  const { results } = await db
    .prepare(`SELECT * FROM user_notification_preferences WHERE project_id = ? AND user_id = ? ORDER BY topic`)
    .bind(projectId, userId)
    .all();
  return (results || []).map(mapPrefRow);
}

export async function upsertPreference(db, { projectId, userId, topic, roomId, pushEnabled, inAppEnabled, emailEnabled, digestFrequency, priorityLevel }) {
  if (!VALID_TOPICS.includes(topic)) return { ok: false, error: "invalid_topic" };
  if (digestFrequency && !VALID_DIGEST.includes(digestFrequency)) return { ok: false, error: "invalid_digest_frequency" };
  if (priorityLevel && !VALID_PRIORITY.includes(priorityLevel)) return { ok: false, error: "invalid_priority_level" };

  const existing = await getPreference(db, { projectId, userId, topic, roomId });
  const now = new Date().toISOString();
  const id = existing?.id || crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO user_notification_preferences (id, project_id, user_id, topic, room_id, push_enabled, in_app_enabled, email_enabled, digest_frequency, priority_level, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_id, user_id, topic, room_id) DO UPDATE SET
         push_enabled = excluded.push_enabled,
         in_app_enabled = excluded.in_app_enabled,
         email_enabled = excluded.email_enabled,
         digest_frequency = excluded.digest_frequency,
         priority_level = excluded.priority_level,
         updated_at = excluded.updated_at`,
    )
    .bind(
      id, projectId, userId, topic, roomId ?? null,
      pushEnabled !== undefined ? (pushEnabled ? 1 : 0) : (existing?.pushEnabled ?? 1),
      inAppEnabled !== undefined ? (inAppEnabled ? 1 : 0) : (existing?.inAppEnabled ?? 1),
      emailEnabled !== undefined ? (emailEnabled ? 1 : 0) : (existing?.emailEnabled ?? 0),
      digestFrequency || existing?.digestFrequency || "realtime",
      priorityLevel || existing?.priorityLevel || "normal",
      existing?.createdAt || now, now,
    )
    .run();

  return { ok: true, id };
}

export async function deletePreference(db, { projectId, userId, topic, roomId }) {
  const result = await db
    .prepare(
      `DELETE FROM user_notification_preferences WHERE project_id = ? AND user_id = ? AND topic = ? AND ${roomId ? "room_id = ?" : "room_id IS NULL"}`,
    )
    .bind(projectId, userId, topic, ...(roomId ? [roomId] : []))
    .run();
  return { ok: true, deleted: (result.meta?.changes || 0) > 0 };
}

/* ── Notification Snooze Rules ── */

export async function createSnoozeRule(db, { projectId, userId, roomId, threadId, customerId, snoozeUntil, reason }) {
  if (!snoozeUntil) return { ok: false, error: "snooze_until_required" };

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO notification_snooze_rules (id, project_id, user_id, room_id, thread_id, customer_id, snooze_until, reason, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, projectId, userId, roomId ?? null, threadId ?? null, customerId ?? null, snoozeUntil, reason ?? null, now, now)
    .run();

  return { ok: true, id };
}

export async function listSnoozeRules(db, { projectId, userId }) {
  const { results } = await db
    .prepare(
      `SELECT * FROM notification_snooze_rules WHERE project_id = ? AND user_id = ? ORDER BY snooze_until ASC`,
    )
    .bind(projectId, userId)
    .all();
  return (results || []).map(mapSnoozeRow);
}

export async function deleteSnoozeRule(db, { projectId, userId, ruleId }) {
  const result = await db
    .prepare(`DELETE FROM notification_snooze_rules WHERE id = ? AND project_id = ? AND user_id = ?`)
    .bind(ruleId, projectId, userId)
    .run();
  return { ok: true, deleted: (result.meta?.changes || 0) > 0 };
}

/**
 * Check if notifications should be snoozed for a given context.
 */
export async function isNotificationSnoozed(db, { projectId, userId, roomId, threadId, customerId }) {
  const now = new Date().toISOString();
  const row = await db
    .prepare(
      `SELECT id FROM notification_snooze_rules
       WHERE project_id = ? AND user_id = ? AND snooze_until > ?
         AND (room_id IS NULL OR room_id = ?)
         AND (thread_id IS NULL OR thread_id = ?)
         AND (customer_id IS NULL OR customer_id = ?)
       LIMIT 1`,
    )
    .bind(projectId, userId, now, roomId ?? null, threadId ?? null, customerId ?? null)
    .first();
  return Boolean(row);
}

/**
 * Clean up expired snooze rules.
 */
export async function cleanExpiredSnoozeRules(db, { projectId }) {
  const now = new Date().toISOString();
  const result = await db
    .prepare(`DELETE FROM notification_snooze_rules WHERE project_id = ? AND snooze_until <= ?`)
    .bind(projectId, now)
    .run();
  return { ok: true, cleaned: result.meta?.changes || 0 };
}

/* ── Priority Helpers ── */

/**
 * Get priority weight for sorting notifications.
 */
export function priorityWeight(level) {
  switch (level) {
    case "urgent": return 4;
    case "high": return 3;
    case "normal": return 2;
    case "low": return 1;
    default: return 2;
  }
}

/**
 * Should this notification bypass quiet hours?
 */
export function shouldBypassQuietHours(priorityLevel) {
  return priorityLevel === "urgent";
}

/* ── Mappers ── */

function mapPrefRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    topic: row.topic,
    roomId: row.room_id ?? null,
    pushEnabled: Boolean(row.push_enabled),
    inAppEnabled: Boolean(row.in_app_enabled),
    emailEnabled: Boolean(row.email_enabled),
    digestFrequency: row.digest_frequency,
    priorityLevel: row.priority_level,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSnoozeRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    roomId: row.room_id ?? null,
    threadId: row.thread_id ?? null,
    customerId: row.customer_id ?? null,
    snoozeUntil: row.snooze_until,
    reason: row.reason ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
