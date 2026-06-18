import { logError, logInfo } from "./worker-log.js";
import { shouldBatchNotification } from "./quiet-hours.js";
import { enqueueBatchedNotification } from "./notification-batch.js";
import { safeOutboundFetch } from "./url-ssrf.js";
import {
  getOrCreateVapidKeyPair,
  getVapidPublicKeyRaw,
  buildVapidJwt,
  encryptWebPushPayload,
  classifyPushResponse,
} from "./vapid.js";

const VALID_PLATFORMS = new Set(["fcm", "web"]);

/**
 * @param {*} env
 */
export function isPushEnabled(env) {
  return Boolean(env.FCM_SERVER_KEY?.trim() || env.PUSH_ENABLED === "true");
}

/**
 * True if Web Push (VAPID) is configured for this project.
 * Returns the public key (base64url) when ready, else null.
 */
export async function getVapidPublicKeyForProject(env, projectId) {
  try {
    const { publicKey } = await getOrCreateVapidKeyPair(env, projectId);
    return await getVapidPublicKeyRaw(publicKey);
  } catch (err) {
    logError("vapid.public_key_failed", err, { projectId });
    return null;
  }
}

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   userId: string,
 *   platform: string,
 *   token: string,
 * }} input
 */
export async function registerPushDevice(env, input) {
  const platform = String(input.platform || "").toLowerCase();
  if (!VALID_PLATFORMS.has(platform)) {
    return { ok: false, error: "invalid_platform" };
  }
  const token = String(input.token || "").trim();
  if (!token || token.length > 4096) {
    return { ok: false, error: "invalid_token" };
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO user_push_devices (id, project_id, user_id, platform, token, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, platform, token) DO UPDATE SET
       user_id = excluded.user_id,
       updated_at = excluded.updated_at`,
  )
    .bind(id, input.projectId, input.userId, platform, token, now, now)
    .run();

  return { ok: true, id };
}

/**
 * @param {*} env
 * @param {string} projectId
 * @param {string} userId
 * @param {string} deviceId
 */
export async function unregisterPushDevice(env, projectId, userId, deviceId) {
  await env.DB.prepare(
    `DELETE FROM user_push_devices WHERE id = ? AND project_id = ? AND user_id = ?`,
  )
    .bind(deviceId, projectId, userId)
    .run();
  return { ok: true };
}

/**
 * @param {*} env
 * @param {string} projectId
 * @param {string} userId
 */
export async function listPushDevices(env, projectId, userId) {
  const rows = await env.DB.prepare(
    `SELECT id, platform, token, created_at, updated_at FROM user_push_devices
     WHERE project_id = ? AND user_id = ? ORDER BY updated_at DESC`,
  )
    .bind(projectId, userId)
    .all();
  return (rows.results || []).map((r) => ({
    id: r.id,
    platform: r.platform,
    tokenPreview: `${String(r.token).slice(0, 8)}…`,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/**
 * @param {*} env
 * @param {string} projectId
 * @param {string} userId
 */
export async function getFcmTokensForUser(env, projectId, userId) {
  const rows = await env.DB.prepare(
    `SELECT token FROM user_push_devices
     WHERE project_id = ? AND user_id = ? AND platform = 'fcm'`,
  )
    .bind(projectId, userId)
    .all();
  return (rows.results || []).map((r) => r.token).filter(Boolean);
}

/**
 * Legacy FCM HTTP API (server key).
 * @param {*} env
 * @param {string[]} tokens
 * @param {{ title: string, body: string, data?: Record<string, string> }} payload
 */
export async function sendFcmNotification(env, tokens, payload) {
  const serverKey = env.FCM_SERVER_KEY?.trim();
  if (!serverKey || !tokens.length) return { sent: 0 };

  const res = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      Authorization: `key=${serverKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      registration_ids: tokens.slice(0, 500),
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data ?? {},
      priority: "high",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`fcm_${res.status}:${text.slice(0, 120)}`);
  }

  const json = await res.json().catch(() => ({}));
  return { sent: Number(json.success) || tokens.length, failure: json.failure };
}

/**
 * Notify room members (except author) on new message when push is configured.
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   roomId: string,
 *   authorUserId: string,
 *   messageId: number,
 *   preview?: string,
 *   mentionedUserIds?: string[],
 * }} detail
 */
export async function maybePushNotifyOnMessage(env, detail) {
  if (!isPushEnabled(env)) return;

  const {
    projectId,
    roomId,
    authorUserId,
    messageId,
    preview = "",
    mentionedUserIds = [],
  } = detail;

  try {
    const members = await env.DB.prepare(
      `SELECT user_id, notify_enabled FROM room_members WHERE room_id = ?`,
    )
      .bind(roomId)
      .all();

    const mentionSet = new Set(mentionedUserIds);
    const title = "New message";
    const body = String(preview).slice(0, 120) || "You have a new message";

    for (const row of members.results || []) {
      const userId = row.user_id;
      if (!userId || userId === authorUserId) continue;
      if (row.notify_enabled === 0 && !mentionSet.has(userId)) continue;

      const pushTitle = mentionSet.has(userId) ? "Mention" : title;
      const pushKind = mentionSet.has(userId) ? "mention" : "message";

      if (await shouldBatchNotification(env, projectId, userId, "push")) {
        await enqueueBatchedNotification(env, {
          projectId,
          userId,
          channel: "push",
          kind: pushKind,
          title: pushTitle,
          body,
          roomId,
          messageId,
          payload: { type: "message.created" },
        });
        logInfo("push.batched", { projectId, roomId, userId, messageId });
        continue;
      }

      const tokens = await getFcmTokensForUser(env, projectId, userId);
      if (tokens.length) {
        await sendFcmNotification(env, tokens, {
          title: pushTitle,
          body,
          data: {
            roomId,
            messageId: String(messageId),
            type: "message.created",
          },
        });
      }

      await sendWebPushToUser(env, {
        projectId,
        userId,
        title: pushTitle,
        body,
        roomId,
        messageId,
      });

      logInfo("push.sent", { projectId, roomId, userId, messageId, fcm: tokens.length });
    }
  } catch (err) {
    logError("push.notify_failed", err, { projectId, roomId, messageId });
  }
}

/**
 * Register a Web Push subscription for the given user.
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   userId: string,
 *   endpoint: string,
 *   p256dh: string,
 *   auth: string,
 *   userAgent?: string,
 * }} input
 */
export async function registerWebPushSubscription(env, input) {
  if (!input?.projectId || !input?.userId) {
    return { ok: false, error: "missing_identity" };
  }
  const endpoint = String(input.endpoint || "").trim();
  const p256dh = String(input.p256dh || "").trim();
  const auth = String(input.auth || "").trim();
  if (!endpoint || !/^https?:\/\//.test(endpoint)) {
    return { ok: false, error: "invalid_endpoint" };
  }
  if (!p256dh || !auth) {
    return { ok: false, error: "invalid_keys" };
  }
  if (endpoint.length > 4096 || p256dh.length > 1024 || auth.length > 256) {
    return { ok: false, error: "field_too_long" };
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO web_push_subscriptions
       (id, project_id, user_id, endpoint, p256dh, auth, user_agent, created_at, updated_at, failure_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(project_id, endpoint) DO UPDATE SET
       user_id = excluded.user_id,
       p256dh = excluded.p256dh,
       auth = excluded.auth,
       user_agent = excluded.user_agent,
       updated_at = excluded.updated_at,
       failure_count = 0`
  )
    .bind(
      id,
      input.projectId,
      input.userId,
      endpoint,
      p256dh,
      auth,
      String(input.userAgent || "").slice(0, 256) || null,
      now,
      now
    )
    .run();
  return { ok: true };
}

/**
 * Unregister a Web Push subscription (best-effort match by endpoint or id).
 */
export async function unregisterWebPushSubscription(env, projectId, userId, identifier) {
  const id = String(identifier || "").trim();
  if (!id) return { ok: false, error: "missing_identifier" };
  // Try by primary id first, then endpoint URL.
  const byId = await env.DB.prepare(
    `DELETE FROM web_push_subscriptions WHERE id = ? AND project_id = ? AND user_id = ?`
  )
    .bind(id, projectId, userId)
    .run();
  if (byId.meta?.changes) return { ok: true, removed: byId.meta.changes };
  const byEndpoint = await env.DB.prepare(
    `DELETE FROM web_push_subscriptions WHERE endpoint = ? AND project_id = ? AND user_id = ?`
  )
    .bind(id, projectId, userId)
    .run();
  return { ok: true, removed: byEndpoint.meta?.changes || 0 };
}

/**
 * List a user's Web Push subscriptions (metadata only).
 */
export async function listWebPushSubscriptions(env, projectId, userId) {
  const rows = await env.DB.prepare(
    `SELECT id, endpoint, user_agent, created_at, updated_at, last_sent_at, failure_count
     FROM web_push_subscriptions
     WHERE project_id = ? AND user_id = ?
     ORDER BY updated_at DESC`
  )
    .bind(projectId, userId)
    .all();
  return (rows.results || []).map((r) => ({
    id: r.id,
    endpointHost: safeHost(r.endpoint),
    endpointPreview: `${String(r.endpoint).slice(0, 32)}…${String(r.endpoint).slice(-12)}`,
    userAgent: r.user_agent,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lastSentAt: r.last_sent_at,
    failureCount: r.failure_count,
  }));
}

function safeHost(endpoint) {
  try {
    return new URL(endpoint).host;
  } catch {
    return "unknown";
  }
}

/**
 * Send a Web Push payload to all subscriptions for a single user.
 * Tolerant of failures — bad subscriptions are removed or marked.
 */
export async function sendWebPushToUser(env, { projectId, userId, title, body, roomId, messageId, url }) {
  try {
    const { privateKey, subject } = await getOrCreateVapidKeyPair(env, projectId);
    const subs = await env.DB.prepare(
      `SELECT id, endpoint, p256dh, auth, failure_count FROM web_push_subscriptions
       WHERE project_id = ? AND user_id = ? AND failure_count < 10`
    )
      .bind(projectId, userId)
      .all();
    if (!subs.results?.length) return { sent: 0 };

    const payload = JSON.stringify({
      title,
      body,
      icon: env.WEB_PUSH_ICON || "/icon-192.png",
      badge: env.WEB_PUSH_BADGE || "/badge-72.png",
      tag: `fluxychat-${roomId || "global"}`,
      data: {
        roomId,
        messageId: messageId != null ? String(messageId) : null,
        url: url || (env.PUBLIC_APP_URL ? `${env.PUBLIC_APP_URL}/rooms/${roomId}` : "/"),
        type: "message.created",
      },
    });

    let sent = 0;
    for (const sub of subs.results) {
      try {
        // Audit A-1: the subscription endpoint comes from the user's
        // browser. A malicious user could register an endpoint that
        // points at internal Cloudflare metadata (169.254.169.254) or
        // the loopback address, then use web-push to probe internal
        // services. Guard with safeOutboundFetch.
        const audience = new URL(sub.endpoint).origin;
        const jwt = await buildVapidJwt(privateKey, audience, subject);
        const { ciphertext } = await encryptWebPushPayload(payload, sub.p256dh, sub.auth);
        const res = await safeOutboundFetch(sub.endpoint, {
          method: "POST",
          headers: {
            "Authorization": `vapid t=${jwt}, k=${await getVapidPublicKeyRaw((await getOrCreateVapidKeyPair(env, projectId)).publicKey)}`,
            "Content-Encoding": "aes128gcm",
            "Content-Type": "application/octet-stream",
            "TTL": "60",
            "Urgency": "normal",
          },
          body: ciphertext,
        });
        const outcome = classifyPushResponse(res.status);
        if (outcome === "delivered") {
          sent++;
          await env.DB.prepare(
            "UPDATE web_push_subscriptions SET last_sent_at = ?, failure_count = 0, updated_at = ? WHERE id = ?"
          )
            .bind(new Date().toISOString(), new Date().toISOString(), sub.id)
            .run();
        } else if (outcome === "gone") {
          await env.DB.prepare("DELETE FROM web_push_subscriptions WHERE id = ?")
            .bind(sub.id)
            .run();
        } else {
          await env.DB.prepare(
            "UPDATE web_push_subscriptions SET failure_count = failure_count + 1, updated_at = ? WHERE id = ?"
          )
            .bind(new Date().toISOString(), sub.id)
            .run();
        }
        logInfo("push.web_sent", {
          projectId,
          userId,
          subscriptionId: sub.id,
          outcome,
          status: res.status,
        });
      } catch (err) {
        logError("push.web_send_failed", err, {
          projectId,
          userId,
          subscriptionId: sub.id,
        });
        await env.DB.prepare(
          "UPDATE web_push_subscriptions SET failure_count = failure_count + 1, updated_at = ? WHERE id = ?"
        )
          .bind(new Date().toISOString(), sub.id)
          .run();
      }
    }
    return { sent };
  } catch (err) {
    logError("push.web_notify_failed", err, { projectId, userId });
    return { sent: 0 };
  }
}

