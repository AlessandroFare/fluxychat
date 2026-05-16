import { logError } from "./worker-log.js";
import { deliverWebhooks } from "./webhook-delivery.js";
import { workerSharedLlmAllowed } from "./hosted-saas-policy.js";

export async function schedulePostMessageAutomations(env, detail) {
  try {
    await Promise.all([
      maybeTriggerAutoRoomSummary(env, detail.projectId, detail.roomId),
      maybeRunBuiltinModerationScan(env, detail),
    ]);
  } catch (err) {
    logError("post_message_automations_failed", err, {
      projectId: detail.projectId,
      roomId: detail.roomId,
    });
  }
}

async function maybeRunBuiltinModerationScan(env, opts) {
  const {
    projectId,
    roomId,
    authorUserId,
    messageId,
    content,
    traceId,
  } = opts;

  try {
    if (
      env.BUILTIN_MODERATION_ENABLED !== "true" &&
      env.BUILTIN_MODERATION_ENABLED !== "1"
    ) {
      return;
    }
    const raw = env.BUILTIN_MODERATION_BLOCKED_SUBSTRINGS || "";
    const tokens = raw
      .split(",")
      .map((t) => String(t).trim().toLowerCase())
      .filter(Boolean);
    if (!tokens.length) return;
    if (content === undefined || content === null) return;
    const hay = String(content).toLowerCase();
    const hitToken = tokens.find((tok) => hay.includes(tok));
    if (!hitToken) return;

    const mid = Number(messageId);
    if (!Number.isFinite(mid)) return;

    const dup = await env.DB.prepare(
      "SELECT 1 AS ok FROM moderation_events WHERE project_id = ? AND target_message_id = ? AND action = 'auto_flag' LIMIT 1"
    )
      .bind(projectId, mid)
      .first();
    if (dup?.ok) return;

    const now = new Date().toISOString();
    const reason = `builtin_substring:${hitToken.slice(0, 80)}`;

    const insert = await env.DB.prepare(
      "INSERT INTO moderation_events (project_id, room_id, user_id, action, reason, created_at, target_message_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(projectId, roomId, "builtin", "auto_flag", reason, now, mid)
      .run();

    const moderationEventId = insert.meta.last_row_id;

    await env.DB.prepare(
      "INSERT INTO automation_events (project_id, event_type, room_id, payload, created_at) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(
        projectId,
        "moderation_builtin_flag",
        roomId,
        JSON.stringify({
          moderationEventId,
          messageId: mid,
          matched: hitToken,
          authorUserId,
          traceId: traceId || null,
        }),
        now
      )
      .run();

    await deliverWebhooks(env, projectId, "moderation.auto_flag", {
      moderationEventId,
      roomId,
      messageId: mid,
      authorUserId,
      matchedSubstring: hitToken,
      traceId: traceId || null,
    });
  } catch (err) {
    logError("automation.builtin_moderation_failed", err, {
      projectId,
      roomId,
      messageId,
    });
  }
}

async function maybeTriggerAutoRoomSummary(env, projectId, roomId) {
  try {
    if (
      env.AUTO_ROOM_SUMMARY_ENABLED !== "true" &&
      env.AUTO_ROOM_SUMMARY_ENABLED !== "1"
    ) {
      return;
    }
    if (!env.AI_BASE_URL) return;
    const everyN = Number(env.AUTO_ROOM_SUMMARY_EVERY_N || 0);
    if (!Number.isFinite(everyN) || everyN <= 0) return;

    const countRow = await env.DB.prepare(
      "SELECT CAST(COUNT(*) AS INTEGER) AS c FROM messages WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL"
    )
      .bind(projectId, roomId)
      .first();
    const total = Number(countRow?.c ?? 0);
    if (total < everyN || total % everyN !== 0) return;

    const cooldownMin = Number(env.AUTO_ROOM_SUMMARY_COOLDOWN_MINUTES ?? 120);
    const cooldownMs = Math.max(0, cooldownMin) * 60_000;

    if (cooldownMs > 0) {
      const last = await env.DB.prepare(
        "SELECT created_at FROM automation_events WHERE project_id = ? AND room_id = ? AND event_type IN ('room_summary_auto', 'room_summary') ORDER BY id DESC LIMIT 1"
      )
        .bind(projectId, roomId)
        .first();
      if (last?.created_at) {
        const elapsed = Date.now() - Date.parse(last.created_at);
        if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < cooldownMs) {
          return;
        }
      }
    }

    const createdAt = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO automation_events (project_id, event_type, room_id, payload, created_at) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(
        projectId,
        "room_summary_auto",
        roomId,
        JSON.stringify({
          trigger: "every_n_messages",
          everyN,
          totalMessages: total,
        }),
        createdAt
      )
      .run();

    await generateRoomSummaryAndAnnounce(env, projectId, roomId);
  } catch (err) {
    logError("automation.auto_room_summary_failed", err, { projectId, roomId });
  }
}

export async function generateRoomSummaryAndAnnounce(env, projectId, roomId) {
  if (!workerSharedLlmAllowed(env, projectId)) {
    return;
  }
  if (!env.AI_BASE_URL?.trim()) {
    return;
  }

  const rows = await env.DB.prepare(
    "SELECT user_id, content, created_at FROM messages WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 50"
  )
    .bind(projectId, roomId)
    .all();

  const messages = (rows.results || []).reverse();
  if (!messages.length) return;

  const transcript = messages
    .map(
      (m) =>
        `[${m.created_at}] ${m.user_id}: ${m.content}`.replace(/\s+/g, " ")
    )
    .join("\n");

  const systemPrompt =
    "You are a concise system assistant for a developer chat product called fluxychat. Summarize the recent conversation in 2–4 bullet points and optionally suggest one helpful follow-up action.";

  const body = {
    model: env.AI_MODEL || "openai/gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Here is the recent transcript for room "${roomId}":\n\n${transcript}`,
      },
    ],
    max_tokens: 256,
    temperature: 0.3,
  };

  const res = await fetch(`${env.AI_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(env.AI_API_KEY ? { Authorization: `Bearer ${env.AI_API_KEY}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error("AI API error", res.status, await res.text());
    return;
  }

  const json = await res.json();
  const content =
    json.choices?.[0]?.message?.content ||
    "System summary unavailable due to an AI provider issue.";

  const id = env.ROOM.idFromName(roomId);
  const stub = env.ROOM.get(id);
  await stub.fetch("https://internal/announce", {
    method: "POST",
    body: JSON.stringify({
      id: Date.now(),
      content,
      userId: "fluxychat-bot",
    }),
  });
}
