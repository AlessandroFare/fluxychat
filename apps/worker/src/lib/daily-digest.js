import { chatCompletion } from "./ai-chat-completion.js";
import { sendDigestEmail, isValidEmail } from "./digest-email.js";
import { workerSharedLlmAllowed } from "./hosted-saas-policy.js";
import { sendWebPushToUser } from "./push-notifications.js";
import { enqueueBatchedNotification } from "./notification-batch.js";
import { shouldBatchNotification } from "./quiet-hours.js";
import { logError, logInfo } from "./worker-log.js";

const MAX_CONTEXT_MESSAGES = 80;
const MAX_USERS_PER_RUN = 200;

export function digestDateUtc(iso = new Date().toISOString()) {
  return iso.slice(0, 10);
}

export function digestWindowBounds(digestDate) {
  const start = new Date(`${digestDate}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 86_400_000);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export function previousDigestDate(anchorDate) {
  const base = anchorDate
    ? new Date(`${anchorDate}T12:00:00.000Z`)
    : new Date();
  base.setUTCDate(base.getUTCDate() - 1);
  return digestDateUtc(base.toISOString());
}

export function parseDigestHighlights(raw) {
  if (!raw) return [];
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => String(item || "").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .slice(0, 3);
    }
  } catch {
    // bullet fallback
  }
  return cleaned
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•\d.)]+\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 3);
}

export async function getDigestPreferences(env, projectId, userId) {
  const row = await env.DB.prepare(
    `SELECT enabled, email, email_enabled, web_push_enabled, in_app_enabled, updated_at
     FROM user_digest_preferences
     WHERE project_id = ? AND user_id = ?`,
  )
    .bind(projectId, userId)
    .first();

  if (!row) {
    return {
      enabled: false,
      email: null,
      emailEnabled: true,
      webPushEnabled: true,
      inAppEnabled: true,
      updatedAt: null,
    };
  }

  return {
    enabled: row.enabled === 1,
    email: row.email || null,
    emailEnabled: row.email_enabled !== 0,
    webPushEnabled: row.web_push_enabled !== 0,
    inAppEnabled: row.in_app_enabled !== 0,
    updatedAt: row.updated_at,
  };
}

export async function upsertDigestPreferences(env, projectId, userId, patch) {
  const existing = await getDigestPreferences(env, projectId, userId);
  const enabled =
    patch.enabled !== undefined ? Boolean(patch.enabled) : existing.enabled;
  let email =
    patch.email !== undefined
      ? patch.email == null || patch.email === ""
        ? null
        : String(patch.email).trim()
      : existing.email;
  if (email && !isValidEmail(email)) {
    return { ok: false, error: "invalid_email" };
  }
  const emailEnabled =
    patch.emailEnabled !== undefined
      ? Boolean(patch.emailEnabled)
      : existing.emailEnabled;
  const webPushEnabled =
    patch.webPushEnabled !== undefined
      ? Boolean(patch.webPushEnabled)
      : existing.webPushEnabled;
  const inAppEnabled =
    patch.inAppEnabled !== undefined
      ? Boolean(patch.inAppEnabled)
      : existing.inAppEnabled;
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO user_digest_preferences
       (project_id, user_id, enabled, email, email_enabled, web_push_enabled, in_app_enabled, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, user_id) DO UPDATE SET
       enabled = excluded.enabled,
       email = excluded.email,
       email_enabled = excluded.email_enabled,
       web_push_enabled = excluded.web_push_enabled,
       in_app_enabled = excluded.in_app_enabled,
       updated_at = excluded.updated_at`,
  )
    .bind(
      projectId,
      userId,
      enabled ? 1 : 0,
      email,
      emailEnabled ? 1 : 0,
      webPushEnabled ? 1 : 0,
      inAppEnabled ? 1 : 0,
      now,
    )
    .run();

  return {
    ok: true,
    preferences: {
      enabled,
      email,
      emailEnabled,
      webPushEnabled,
      inAppEnabled,
      updatedAt: now,
    },
  };
}

async function deliveryAlreadyRecorded(env, projectId, userId, digestDate, channel) {
  const row = await env.DB.prepare(
    `SELECT id FROM digest_deliveries
     WHERE project_id = ? AND user_id = ? AND digest_date = ? AND channel = ?
     LIMIT 1`,
  )
    .bind(projectId, userId, digestDate, channel)
    .first();
  return Boolean(row?.id);
}

async function recordDelivery(env, input) {
  await env.DB.prepare(
    `INSERT INTO digest_deliveries
       (id, project_id, user_id, digest_date, channel, status, highlights_json, error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      input.projectId,
      input.userId,
      input.digestDate,
      input.channel,
      input.status,
      input.highlights?.length ? JSON.stringify(input.highlights) : null,
      input.error || null,
      new Date().toISOString(),
    )
    .run();
}

async function fetchYesterdayMessages(env, projectId, userId, startIso, endIso) {
  const rooms = await env.DB.prepare(
    `SELECT rm.room_id, r.name
     FROM room_members rm
     JOIN rooms r ON r.id = rm.room_id AND r.project_id = ?
     WHERE rm.user_id = ?`,
  )
    .bind(projectId, userId)
    .all();

  const roomRows = rooms.results || [];
  if (!roomRows.length) return { messages: [], roomNames: new Map() };

  const roomNames = new Map(
    roomRows.map((r) => [r.room_id, r.name || r.room_id]),
  );
  const roomIds = roomRows.map((r) => r.room_id);
  const placeholders = roomIds.map(() => "?").join(", ");

  const rows = await env.DB.prepare(
    `SELECT room_id, user_id, content, created_at
     FROM messages
     WHERE project_id = ? AND room_id IN (${placeholders})
       AND deleted_at IS NULL
       AND created_at >= ? AND created_at < ?
     ORDER BY created_at ASC
     LIMIT ?`,
  )
    .bind(projectId, ...roomIds, startIso, endIso, MAX_CONTEXT_MESSAGES)
    .all();

  return { messages: rows.results || [], roomNames };
}

async function generateHighlights(env, input) {
  if (!workerSharedLlmAllowed(env, input.projectId)) {
    return { ok: false, error: "ai_not_available" };
  }

  const transcript = input.messages
    .map((m) => {
      const roomLabel = input.roomNames.get(m.room_id) || m.room_id;
      return `[${roomLabel}] ${m.user_id}: ${String(m.content || "").replace(/\s+/g, " ").slice(0, 180)}`;
    })
    .join("\n");

  const ai = await chatCompletion(env, {
    maxTokens: 220,
    temperature: 0.35,
    logContext: {
      projectId: input.projectId,
      userId: input.userId,
      digestDate: input.digestDate,
    },
    messages: [
      {
        role: "system",
        content:
          "You write a daily chat digest. Return exactly 3 short highlight strings as a JSON array. Each highlight is one sentence under 120 characters. Return ONLY the JSON array.",
      },
      {
        role: "user",
        content: `Summarize key moments from ${input.digestDate} for user "${input.userId}":\n\n${transcript}`,
      },
    ],
  });

  if (!ai.ok) return ai;
  const highlights = parseDigestHighlights(ai.content);
  if (!highlights.length) return { ok: false, error: "empty_highlights" };
  return { ok: true, highlights };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDigestBody(highlights, digestDate, appUrl) {
  const lines = highlights.map((h, i) => `${i + 1}. ${h}`);
  const textBody = [`Your FluxyChat highlights for ${digestDate}:`, "", ...lines].join("\n");
  const htmlBody = [
    `<p>Your FluxyChat highlights for <strong>${digestDate}</strong>:</p>`,
    "<ol>",
    ...highlights.map((h) => `<li>${escapeHtml(h)}</li>`),
    "</ol>",
    appUrl ? `<p><a href="${escapeHtml(appUrl)}">Open FluxyChat</a></p>` : "",
  ].join("");
  return { textBody, htmlBody, pushBody: lines.join(" · ") };
}

export async function deliverUserDigest(env, input) {
  const appUrl = env.PUBLIC_APP_URL?.trim() || null;
  const { textBody, htmlBody, pushBody } = formatDigestBody(
    input.highlights,
    input.digestDate,
    appUrl,
  );
  const title = `Yesterday in chat — ${input.digestDate}`;
  const { projectId, userId, digestDate, prefs, highlights } = input;

  if (prefs.inAppEnabled !== false) {
    if (!(await deliveryAlreadyRecorded(env, projectId, userId, digestDate, "in_app"))) {
      try {
        await env.DB.prepare(
          `INSERT INTO in_app_notifications
             (project_id, user_id, kind, title, body, room_id, message_id, read_at, created_at)
           VALUES (?, ?, 'digest', ?, ?, NULL, NULL, NULL, ?)`,
        )
          .bind(projectId, userId, title, pushBody, new Date().toISOString())
          .run();
        await recordDelivery(env, {
          projectId,
          userId,
          digestDate,
          channel: "in_app",
          status: "sent",
          highlights,
        });
      } catch (err) {
        await recordDelivery(env, {
          projectId,
          userId,
          digestDate,
          channel: "in_app",
          status: "failed",
          highlights,
          error: err instanceof Error ? err.message : "in_app_failed",
        });
      }
    }
  }

  if (prefs.webPushEnabled) {
    if (!(await deliveryAlreadyRecorded(env, projectId, userId, digestDate, "web_push"))) {
      try {
        let push = { sent: 0 };
        if (await shouldBatchNotification(env, projectId, userId, "push")) {
          await enqueueBatchedNotification(env, {
            projectId,
            userId,
            channel: "push",
            kind: "digest",
            title,
            body: pushBody,
            roomId: null,
            messageId: null,
            payload: { type: "digest", digestDate, url: appUrl || "/notifications" },
          });
          push = { sent: 1 };
        } else {
          push = await sendWebPushToUser(env, {
            projectId,
            userId,
            title,
            body: pushBody,
            roomId: null,
            messageId: null,
            url: appUrl || "/notifications",
          });
        }
        await recordDelivery(env, {
          projectId,
          userId,
          digestDate,
          channel: "web_push",
          status: push.sent > 0 ? "sent" : "skipped",
          highlights,
          error: push.sent > 0 ? null : "no_subscriptions",
        });
      } catch (err) {
        await recordDelivery(env, {
          projectId,
          userId,
          digestDate,
          channel: "web_push",
          status: "failed",
          highlights,
          error: err instanceof Error ? err.message : "web_push_failed",
        });
      }
    }
  }

  if (prefs.emailEnabled && prefs.email && isValidEmail(prefs.email)) {
    if (!(await deliveryAlreadyRecorded(env, projectId, userId, digestDate, "email"))) {
      const email = await sendDigestEmail(env, {
        to: prefs.email,
        subject: title,
        textBody,
        htmlBody,
      });
      await recordDelivery(env, {
        projectId,
        userId,
        digestDate,
        channel: "email",
        status: email.ok ? "sent" : email.skipped ? "skipped" : "failed",
        highlights,
        error: email.ok ? null : email.reason || email.error || "email_failed",
      });
    }
  }
}

export async function processUserDailyDigest(env, input) {
  const { startIso, endIso } = digestWindowBounds(input.digestDate);
  const { messages, roomNames } = await fetchYesterdayMessages(
    env,
    input.projectId,
    input.userId,
    startIso,
    endIso,
  );
  if (!messages.length) {
    logInfo("digest.user_skipped_no_messages", {
      projectId: input.projectId,
      userId: input.userId,
      digestDate: input.digestDate,
    });
    return { ok: true, skipped: true, reason: "no_messages" };
  }

  const highlightsResult = await generateHighlights(env, {
    projectId: input.projectId,
    userId: input.userId,
    digestDate: input.digestDate,
    messages,
    roomNames,
  });
  if (!highlightsResult.ok) {
    logError("digest.highlights_failed", new Error(highlightsResult.error), {
      projectId: input.projectId,
      userId: input.userId,
      digestDate: input.digestDate,
    });
    return { ok: false, error: highlightsResult.error };
  }

  await deliverUserDigest(env, {
    projectId: input.projectId,
    userId: input.userId,
    digestDate: input.digestDate,
    prefs: input.prefs,
    highlights: highlightsResult.highlights,
  });

  return { ok: true, highlights: highlightsResult.highlights };
}

export async function runDailyDigest(env, options = {}) {
  if (
    !options.force &&
    env.DAILY_DIGEST_ENABLED !== "true" &&
    env.DAILY_DIGEST_ENABLED !== "1"
  ) {
    logInfo("digest.skipped_disabled");
    return { ok: true, skipped: true, reason: "disabled" };
  }
  if (!env.DB) return { ok: false, error: "no_db" };

  const digestDate = options.digestDate || previousDigestDate();
  const maxUsers = Math.min(
    Number(options.maxUsers || env.DIGEST_MAX_USERS_PER_RUN || MAX_USERS_PER_RUN),
    MAX_USERS_PER_RUN,
  );

  logInfo("digest.run_started", { digestDate, maxUsers });

  const users = await env.DB.prepare(
    `SELECT project_id, user_id, email, email_enabled, web_push_enabled, in_app_enabled
     FROM user_digest_preferences
     WHERE enabled = 1
     ORDER BY updated_at ASC
     LIMIT ?`,
  )
    .bind(maxUsers)
    .all();

  let processed = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of users.results || []) {
    processed += 1;
    const prefs = {
      email: row.email,
      emailEnabled: row.email_enabled !== 0,
      webPushEnabled: row.web_push_enabled !== 0,
      inAppEnabled: row.in_app_enabled !== 0,
    };
    try {
      const result = await processUserDailyDigest(env, {
        projectId: row.project_id,
        userId: row.user_id,
        digestDate,
        prefs,
      });
      if (result.skipped) skipped += 1;
      else if (result.ok) sent += 1;
      else failed += 1;
    } catch (err) {
      failed += 1;
      logError("digest.user_failed", err, {
        projectId: row.project_id,
        userId: row.user_id,
        digestDate,
      });
    }
  }

  logInfo("digest.run_finished", { digestDate, processed, sent, skipped, failed });
  return { ok: true, digestDate, processed, sent, skipped, failed };
}
