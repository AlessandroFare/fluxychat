/**
 * Batched notifications during quiet hours (P12-N).
 */
import { logError, logInfo } from "./worker-log.js";
import {
  getFcmTokensForUser,
  sendFcmNotification,
  sendWebPushToUser,
} from "./push-notifications.js";
import { getQuietHoursPreferences, isInQuietHours } from "./quiet-hours.js";

const MAX_BATCH_ITEMS = 100;
const MAX_FLUSH_USERS = 200;

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   userId: string,
 *   channel: "push" | "in_app",
 *   kind: string,
 *   title: string,
 *   body?: string | null,
 *   roomId?: string | null,
 *   messageId?: number | null,
 *   payload?: Record<string, unknown>,
 * }} input
 */
export async function enqueueBatchedNotification(env, input) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO notification_batch_queue
       (id, project_id, user_id, channel, kind, title, body, room_id, message_id, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      input.projectId,
      input.userId,
      input.channel,
      input.kind,
      input.title,
      input.body ?? null,
      input.roomId ?? null,
      input.messageId ?? null,
      input.payload ? JSON.stringify(input.payload) : null,
      now,
    )
    .run();
  return { ok: true, id };
}

/**
 * @param {*} env
 * @param {string} projectId
 * @param {string} userId
 */
export async function countPendingBatch(env, projectId, userId) {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM notification_batch_queue
     WHERE project_id = ? AND user_id = ?`,
  )
    .bind(projectId, userId)
    .first();
  return Number(row?.cnt ?? 0);
}

/**
 * @param {*} env
 * @param {string} projectId
 * @param {string} userId
 */
export async function flushUserNotificationBatch(env, projectId, userId) {
  const rows = await env.DB.prepare(
    `SELECT id, channel, kind, title, body, room_id, message_id, payload_json, created_at
     FROM notification_batch_queue
     WHERE project_id = ? AND user_id = ?
     ORDER BY created_at ASC
     LIMIT ?`,
  )
    .bind(projectId, userId, MAX_BATCH_ITEMS)
    .all();

  const items = rows.results ?? [];
  if (!items.length) return { flushed: 0 };

  const pushItems = items.filter((r) => r.channel === "push");
  const inAppItems = items.filter((r) => r.channel === "in_app");

  if (pushItems.length) {
    const rooms = [
      ...new Set(pushItems.map((r) => r.room_id).filter(Boolean)),
    ];
    const mentionCount = pushItems.filter((r) => r.kind === "mention").length;
    const title =
      pushItems.length === 1
        ? pushItems[0].title
        : `${pushItems.length} notifications`;
    const bodyParts = [];
    if (mentionCount) bodyParts.push(`${mentionCount} mention${mentionCount > 1 ? "s" : ""}`);
    const dmCount = pushItems.filter((r) => r.kind === "dm" || r.kind === "message").length;
    if (dmCount) bodyParts.push(`${dmCount} message${dmCount > 1 ? "s" : ""}`);
    if (rooms.length) bodyParts.push(`in ${rooms.slice(0, 3).join(", ")}`);
    const body =
      pushItems.length === 1
        ? String(pushItems[0].body || "").slice(0, 120)
        : bodyParts.join(" · ") || "While you were in quiet hours";

    const tokens = await getFcmTokensForUser(env, projectId, userId);
    if (tokens.length) {
      await sendFcmNotification(env, tokens, {
        title,
        body,
        data: {
          type: "notification.batch",
          count: String(pushItems.length),
          roomId: rooms[0] || "",
        },
      });
    }

    await sendWebPushToUser(env, {
      projectId,
      userId,
      title,
      body,
      roomId: rooms[0] || null,
      messageId: pushItems[pushItems.length - 1]?.message_id ?? null,
    });
  }

  if (inAppItems.length) {
    const rooms = [
      ...new Set(inAppItems.map((r) => r.room_id).filter(Boolean)),
    ];
    const summary =
      inAppItems.length === 1
        ? String(inAppItems[0].body || inAppItems[0].title).slice(0, 200)
        : [
            `${inAppItems.length} alerts batched during quiet hours.`,
            rooms.length ? `Rooms: ${rooms.slice(0, 4).join(", ")}` : "",
          ]
            .filter(Boolean)
            .join(" ");

    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO in_app_notifications (
        project_id, user_id, kind, title, body, room_id, message_id, created_at
      ) VALUES (?, ?, 'batch', ?, ?, ?, ?, ?)`,
    )
      .bind(
        projectId,
        userId,
        inAppItems.length === 1
          ? inAppItems[0].title
          : `${inAppItems.length} notifications`,
        summary,
        rooms[0] ?? null,
        inAppItems[inAppItems.length - 1]?.message_id ?? null,
        now,
      )
      .run();
  }

  const ids = items.map((r) => r.id);
  const placeholders = ids.map(() => "?").join(", ");
  await env.DB.prepare(
    `DELETE FROM notification_batch_queue WHERE id IN (${placeholders})`,
  )
    .bind(...ids)
    .run();

  logInfo("notification_batch.flushed", {
    projectId,
    userId,
    push: pushItems.length,
    inApp: inAppItems.length,
  });

  return {
    flushed: items.length,
    push: pushItems.length,
    inApp: inAppItems.length,
  };
}

/**
 * Flush users who have pending items and are outside quiet hours.
 * @param {*} env
 */
export async function flushDueNotificationBatches(env) {
  const rows = await env.DB.prepare(
    `SELECT DISTINCT project_id, user_id
     FROM notification_batch_queue
     ORDER BY created_at ASC
     LIMIT ?`,
  )
    .bind(MAX_FLUSH_USERS)
    .all();

  let flushedUsers = 0;
  let flushedItems = 0;

  for (const row of rows.results ?? []) {
    const prefs = await getQuietHoursPreferences(env, row.project_id, row.user_id);
    if (prefs.enabled && isInQuietHours(prefs)) continue;

    try {
      const result = await flushUserNotificationBatch(
        env,
        row.project_id,
        row.user_id,
      );
      if (result.flushed > 0) {
        flushedUsers++;
        flushedItems += result.flushed;
      }
    } catch (err) {
      logError("notification_batch.flush_failed", err, {
        projectId: row.project_id,
        userId: row.user_id,
      });
    }
  }

  return { flushedUsers, flushedItems };
}
