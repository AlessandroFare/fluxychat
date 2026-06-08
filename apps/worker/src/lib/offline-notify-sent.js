import { logError, logInfo } from "./worker-log.js";
import { parseMemberPreferencesJson } from "./member-preferences.js";
import { checkAndConsumeRateLimit } from "./rate-limit.js";
import { insertSentDmDelivery } from "./sent-dm-deliveries.js";
import {
  formatTelcoMessagePreview,
  resolveTelcoMediaTemplateParams,
} from "./telco-outbound-media.js";

const E164_RE = /^\+[1-9]\d{6,14}$/;

export function isOfflineSmsEnabled(env) {
  if (env.OFFLINE_SMS_ENABLED !== "true" && env.OFFLINE_SMS_ENABLED !== "1") {
    return false;
  }
  return Boolean(env.SENT_DM_API_KEY?.trim() && env.SENT_DM_PROFILE_ID?.trim());
}

/**
 * @param {Record<string, unknown>} preferences
 */
export function extractSmsTargetFromPreferences(preferences) {
  if (!preferences || typeof preferences !== "object") return null;
  const e164Raw =
    preferences.smsE164 ?? preferences.sms_e164 ?? preferences.phoneE164;
  const e164 = typeof e164Raw === "string" ? e164Raw.trim() : "";
  if (!E164_RE.test(e164)) return null;
  const optIn = preferences.smsOptIn ?? preferences.sms_opt_in;
  if (optIn === false || optIn === 0 || optIn === "false") return null;
  return { e164, optIn: true };
}

/**
 * @param {*} env
 * @param {{ projectId: string, roomId: string, userId: string, idleMinutes: number }} opts
 */
export async function isUserIdleInRoom(env, { projectId, roomId, userId, idleMinutes }) {
  const windowMs = Math.max(1, idleMinutes) * 60_000;
  const cutoff = new Date(Date.now() - windowMs).toISOString();

  const receipt = await env.DB.prepare(
    `SELECT created_at FROM read_receipts
     WHERE project_id = ? AND room_id = ? AND user_id = ?
     ORDER BY message_id DESC LIMIT 1`,
  )
    .bind(projectId, roomId, userId)
    .first();

  if (!receipt?.created_at) return true;
  return receipt.created_at < cutoff;
}

export function resolveSentDmChannels(env) {
  const raw = env.OFFLINE_SMS_CHANNELS?.trim() || "sms";
  const channels = raw
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter((c) => c === "sms" || c === "whatsapp");
  return channels.length ? channels : ["sms"];
}

/**
 * @param {*} env
 * @param {{ toE164: string, templateName: string, parameters: Record<string, string>, idempotencyKey: string }} opts
 */
export async function sendSentDmTemplate(env, opts) {
  const apiKey = env.SENT_DM_API_KEY?.trim();
  const profileId = env.SENT_DM_PROFILE_ID?.trim();
  const templateName =
    opts.templateName || env.OFFLINE_SMS_TEMPLATE_NAME?.trim() || "chat_notify";
  const channels = resolveSentDmChannels(env);

  const res = await fetch("https://api.sent.dm/v3/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "x-profile-id": profileId,
      "Idempotency-Key": opts.idempotencyKey,
    },
    body: JSON.stringify({
      channel: channels,
      to: [opts.toE164],
      template: {
        name: templateName,
        parameters: opts.parameters,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`sent_dm_${res.status}:${text.slice(0, 200)}`);
  }
  const json = await res.json().catch(() => ({}));
  const sentMessageId =
    (typeof json.id === "string" && json.id) ||
    (typeof json.messageId === "string" && json.messageId) ||
    (typeof json.data?.id === "string" && json.data.id) ||
    null;
  return { ...json, sentMessageId, channels };
}

/**
 * Optional built-in offline SMS via Sent.dm (see docs/cookbook/offline-notify-sent-dm.md).
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   roomId: string,
 *   authorUserId: string,
 *   messageId: number,
 *   content?: string,
 *   mentionedUserIds?: string[],
 *   roomType?: string | null,
 *   attachments?: Array<{ kind?: string, url?: string, name?: string, contentType?: string }>,
 * }} detail
 */
export async function maybeNotifyOfflineSms(env, detail) {
  if (!isOfflineSmsEnabled(env)) return;

  const {
    projectId,
    roomId,
    authorUserId,
    messageId,
    content = "",
    mentionedUserIds = [],
  } = detail;

  let roomType = detail.roomType ?? null;
  if (!roomType) {
    const row = await env.DB.prepare(
      "SELECT type FROM rooms WHERE project_id = ? AND id = ?",
    )
      .bind(projectId, roomId)
      .first();
    roomType = row?.type ?? null;
  }

  /** @type {Set<string>} */
  const recipientIds = new Set();
  for (const uid of mentionedUserIds) {
    if (uid && uid !== authorUserId) recipientIds.add(uid);
  }

  if (roomType === "dm") {
    const members = await env.DB.prepare(
      "SELECT user_id FROM room_members WHERE project_id = ? AND room_id = ?",
    )
      .bind(projectId, roomId)
      .all();
    for (const row of members.results || []) {
      if (row.user_id && row.user_id !== authorUserId) {
        recipientIds.add(row.user_id);
      }
    }
  }

  if (!recipientIds.size) return;

  const idleMinutes = Number(env.OFFLINE_SMS_IDLE_MINUTES || 5);
  const perUserLimit = Number(env.OFFLINE_SMS_PER_USER_PER_HOUR || 6);
  const mediaParams = await resolveTelcoMediaTemplateParams(env, {
    projectId,
    roomId,
    messageId,
    content,
    attachments: detail.attachments,
  });
  const preview = formatTelcoMessagePreview(content, mediaParams);
  const templateName = env.OFFLINE_SMS_TEMPLATE_NAME?.trim() || "chat_notify";

  for (const userId of recipientIds) {
    try {
      const member = await env.DB.prepare(
        `SELECT notify_enabled, preferences_json FROM room_members
         WHERE project_id = ? AND room_id = ? AND user_id = ?`,
      )
        .bind(projectId, roomId, userId)
        .first();

      if (!member || member.notify_enabled === 0) continue;

      const sms = extractSmsTargetFromPreferences(
        parseMemberPreferencesJson(member.preferences_json),
      );
      if (!sms) continue;

      const idle = await isUserIdleInRoom(env, {
        projectId,
        roomId,
        userId,
        idleMinutes,
      });
      if (!idle) continue;

      const rate = await checkAndConsumeRateLimit(env, {
        key: `offline-sms:${projectId}:${userId}`,
        limit: perUserLimit,
        windowSeconds: 3600,
      });
      if (!rate.allowed) continue;

      await sendSentDmTemplate(env, {
        toE164: sms.e164,
        templateName,
        parameters: {
          sender: authorUserId,
          sender_name: authorUserId,
          preview,
          room_id: roomId,
          room_url: env.PUBLIC_APP_URL
            ? `${String(env.PUBLIC_APP_URL).replace(/\/$/, "")}/rooms/${roomId}`
            : roomId,
          ...mediaParams,
        },
        idempotencyKey: `fluxy:${projectId}:${messageId}:${userId}`,
      }).then(async (sent) => {
        await insertSentDmDelivery(env, {
          projectId,
          roomId,
          fluxyMessageId: messageId,
          userId,
          toE164: sms.e164,
          sentMessageId: sent.sentMessageId ?? null,
          status: "sent",
          channel: (sent.channels || ["sms"]).join(","),
        });
      });

      logInfo("offline_sms.sent", {
        projectId,
        roomId,
        messageId,
        userId,
      });
    } catch (err) {
      logError("offline_sms.failed", err, {
        projectId,
        roomId,
        messageId,
        userId,
      });
    }
  }
}
