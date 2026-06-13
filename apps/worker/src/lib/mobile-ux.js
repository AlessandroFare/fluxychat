/**
 * P17-L: Mobile-First UX + Offline Queue
 *
 * Push delivery reliability tracking, offline message queue sync,
 * device registration management, and PWA manifest generation.
 *
 * Architecture:
 * - Push delivery log tracks every push attempt with status + error
 * - Offline message queue stores messages when client is offline, syncs on reconnect
 * - Device registrations track active mobile/web devices per user
 * - PWA manifest served for installable web app on mobile browsers
 *
 * Compounds:
 * - P10-SB7 (FCM push) for push delivery
 * - P10-ext (VAPID web push) for web push
 * - P12-N (quiet hours) for push scheduling
 */

import { logInfo, logError } from "./worker-log.js";

const DEFAULT_OFFLINE_QUEUE_TTL_HOURS = 48;
const MAX_OFFLINE_QUEUE_SIZE = 50;

/**
 * Log a push delivery attempt.
 */
export async function logPushDelivery(env, input) {
  const { projectId, userId, roomId, messageId, platform, status, errorMessage } = input;
  if (!projectId || !userId || !roomId || !platform) return { ok: false, error: "missing_required_fields" };

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    await env.DB.prepare(
      `INSERT INTO push_delivery_log (id, project_id, user_id, room_id, message_id, platform, status, error_message, attempt_count, last_attempt_at, created_at, delivered_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
    )
      .bind(id, projectId, userId, roomId, messageId || null, platform, status || "sent", errorMessage || null, now, now, status === "delivered" ? now : null)
      .run();
  } catch {
    // Non-critical
  }

  return { ok: true, id };
}

/**
 * Get push delivery stats for a project.
 */
export async function getPushDeliveryStats(env, input) {
  const { projectId, userId, from, to } = input;

  let sql = "SELECT status, COUNT(*) as cnt FROM push_delivery_log WHERE project_id = ?";
  const params = [projectId];

  if (userId) {
    sql += " AND user_id = ?";
    params.push(userId);
  }
  if (from) {
    sql += " AND created_at >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND created_at < ?";
    params.push(to);
  }

  sql += " GROUP BY status";

  const rows = await env.DB.prepare(sql).bind(...params).all();
  const byStatus = {};
  let total = 0;
  for (const r of rows.results || []) {
    byStatus[r.status] = r.cnt;
    total += r.cnt;
  }

  return { ok: true, total, byStatus };
}

/**
 * Enqueue a message for offline sync.
 */
export async function enqueueOfflineMessage(env, input) {
  const { projectId, userId, roomId, clientId, content, tempId } = input;
  if (!content?.trim()) return { ok: false, error: "content_required" };

  // Check queue size limit
  const countRow = await env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM offline_message_queue WHERE user_id = ? AND status = 'pending'"
  )
    .bind(userId)
    .first();

  if ((countRow?.cnt || 0) >= MAX_OFFLINE_QUEUE_SIZE) {
    return { ok: false, error: "queue_full", maxSize: MAX_OFFLINE_QUEUE_SIZE };
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const ttlHours = Number(env.OFFLINE_QUEUE_TTL_HOURS) || DEFAULT_OFFLINE_QUEUE_TTL_HOURS;
  const expiresAt = new Date(Date.now() + ttlHours * 3600000).toISOString();

  await env.DB.prepare(
    `INSERT INTO offline_message_queue (id, project_id, user_id, room_id, client_id, content, temp_id, status, attempts, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)`
  )
    .bind(id, projectId, userId, roomId, clientId || null, content, tempId || null, now, expiresAt)
    .run();

  return { ok: true, id, tempId: tempId || null };
}

/**
 * Get pending offline messages for a user.
 */
export async function getPendingOfflineMessages(env, input) {
  const { projectId, userId, roomId } = input;

  let sql = `
    SELECT * FROM offline_message_queue
    WHERE project_id = ? AND user_id = ? AND status = 'pending'
      AND (expires_at IS NULL OR expires_at > datetime('now'))
  `;
  const params = [projectId, userId];

  if (roomId) {
    sql += " AND room_id = ?";
    params.push(roomId);
  }

  sql += " ORDER BY created_at ASC LIMIT ?";
  params.push(MAX_OFFLINE_QUEUE_SIZE);

  const rows = await env.DB.prepare(sql).bind(...params).all();

  const messages = (rows.results || []).map((r) => ({
    id: r.id,
    roomId: r.room_id,
    clientId: r.client_id,
    content: r.content,
    tempId: r.temp_id,
    createdAt: r.created_at,
  }));

  return { ok: true, messages, count: messages.length };
}

/**
 * Mark offline messages as sent after successful sync.
 */
export async function markOfflineMessagesSent(env, input) {
  const { ids } = input;
  if (!ids?.length) return { ok: true, sent: 0 };

  const now = new Date().toISOString();
  let sent = 0;

  // Batch in groups of 25
  for (let i = 0; i < ids.length; i += 25) {
    const batch = ids.slice(i, i + 25);
    for (const id of batch) {
      const result = await env.DB.prepare(
        "UPDATE offline_message_queue SET status = 'sent', sent_at = ? WHERE id = ? AND status = 'pending'"
      )
        .bind(now, id)
        .run();
      if (result.meta?.changes) sent++;
    }
  }

  return { ok: true, sent };
}

/**
 * Sweep expired offline queue entries.
 */
export async function sweepExpiredOfflineQueue(env) {
  const result = await env.DB.prepare(
    "UPDATE offline_message_queue SET status = 'expired' WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at < datetime('now')"
  ).run();

  return { ok: true, expired: result.meta?.changes || 0 };
}

/**
 * Register or update a device.
 */
export async function registerDevice(env, input) {
  const { projectId, userId, platform, endpoint, pushToken, appVersion, osVersion, deviceModel } = input;
  if (!platform) return { ok: false, error: "platform_required" };

  const validPlatforms = ["fcm", "apns", "web", "android", "ios"];
  if (!validPlatforms.includes(platform)) return { ok: false, error: "invalid_platform" };

  const now = new Date().toISOString();

  // Check existing
  const existing = await env.DB.prepare(
    "SELECT id FROM device_registrations WHERE project_id = ? AND user_id = ? AND platform = ? AND (endpoint = ? OR push_token = ?)"
  )
    .bind(projectId, userId, platform, endpoint || null, pushToken || null)
    .first();

  if (existing) {
    await env.DB.prepare(
      `UPDATE device_registrations SET push_token = COALESCE(?, push_token), endpoint = COALESCE(?, endpoint),
       app_version = COALESCE(?, app_version), os_version = COALESCE(?, os_version),
       device_model = COALESCE(?, device_model), is_active = 1, last_seen_at = ?
       WHERE id = ?`
    )
      .bind(pushToken || null, endpoint || null, appVersion || null, osVersion || null, deviceModel || null, now, existing.id)
      .run();
    return { ok: true, id: existing.id, updated: true };
  }

  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO device_registrations (id, project_id, user_id, platform, endpoint, push_token, app_version, os_version, device_model, is_active, last_seen_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  )
    .bind(id, projectId, userId, platform, endpoint || null, pushToken || null, appVersion || null, osVersion || null, deviceModel || null, now, now)
    .run();

  return { ok: true, id, updated: false };
}

/**
 * List active devices for a user.
 */
export async function listDevices(env, input) {
  const { projectId, userId } = input;

  const rows = await env.DB.prepare(
    `SELECT * FROM device_registrations
     WHERE project_id = ? AND user_id = ? AND is_active = 1
     ORDER BY last_seen_at DESC`
  )
    .bind(projectId, userId)
    .all();

  const devices = (rows.results || []).map((r) => ({
    id: r.id,
    platform: r.platform,
    appVersion: r.app_version,
    osVersion: r.os_version,
    deviceModel: r.device_model,
    lastSeenAt: r.last_seen_at,
    createdAt: r.created_at,
  }));

  return { ok: true, devices, count: devices.length };
}

/**
 * Deactivate a device.
 */
export async function deactivateDevice(env, input) {
  const { projectId, userId, deviceId } = input;
  if (!deviceId) return { ok: false, error: "device_id_required" };

  const existing = await env.DB.prepare(
    "SELECT id FROM device_registrations WHERE id = ? AND project_id = ? AND user_id = ?"
  )
    .bind(deviceId, projectId, userId)
    .first();

  if (!existing) return { ok: false, error: "not_found" };

  await env.DB.prepare("UPDATE device_registrations SET is_active = 0 WHERE id = ?")
    .bind(deviceId)
    .run();

  return { ok: true };
}

/**
 * Generate PWA manifest for a project.
 *
 * @param {{ name?: string, shortName?: string, startUrl?: string, backgroundColor?: string, themeColor?: string }} opts
 * @returns {object} PWA manifest
 */
export function generatePWAManifest(opts = {}) {
  return {
    name: opts.name || "FluxyChat",
    short_name: opts.shortName || "Fluxy",
    description: "AI-native communication infrastructure",
    start_url: opts.startUrl || "/",
    display: "standalone",
    background_color: opts.backgroundColor || "#0a0a0f",
    theme_color: opts.themeColor || "#6366f1",
    orientation: "any",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    categories: ["communication", "productivity"],
    scope: "/",
    lang: "en",
  };
}
