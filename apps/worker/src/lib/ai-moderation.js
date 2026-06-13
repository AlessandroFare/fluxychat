/**
 * P16-E: AI Semantic Moderation
 *
 * LLM-based content analysis for toxicity, spam, PII, and harassment.
 * Replaces simple substring blocklist with intelligent semantic detection.
 *
 * Flow:
 * 1. Message arrives → maybeRunAiModeration (post-message automations)
 * 2. LLM analyzes content → structured JSON with severity/categories/action
 * 3. Result queued in ai_moderation_queue
 * 4. Auto-action applied based on severity + policy config
 * 5. Human moderator can review/override via API
 *
 * Severity levels:
 * - none: clean, no action
 * - low: log only
 * - medium: auto-flag for review
 * - high: auto-warn user + flag
 * - critical: auto-mute/delete + flag
 */

import { logError, logInfo } from "./worker-log.js";
import { isAiConfigured } from "./ai-gateway.js";
import { chatCompletion } from "./ai-chat-completion.js";

const MODERATION_CATEGORIES = [
  "toxicity", "spam", "pii", "harassment", "self_harm",
  "hate_speech", "violence", "sexual_content", "misinformation",
];

const SEVERITY_ACTIONS = {
  none: "none",
  low: "log",
  medium: "flag",
  high: "warn",
  critical: "mute",
};

const ANALYSIS_SYSTEM_PROMPT = `You are a content moderation engine for a chat application called FluxyChat.
Analyze the message content and return a structured moderation decision.

## Categories to check
- toxicity: offensive, abusive, or harmful language
- spam: unsolicited commercial content, repetitive messages, scam links
- pii: personally identifiable information (SSN, credit cards, phone numbers, addresses, passwords)
- harassment: targeted attacks, bullying, threats against specific users
- self_harm: mentions of self-harm, suicide, or dangerous behavior
- hate_speech: discrimination based on race, gender, religion, orientation, disability
- violence: threats of violence, graphic descriptions of harm
- sexual_content: explicit sexual content, NSFW material
- misinformation: verifiably false claims presented as fact

## Severity levels
- none: content is clean
- low: mildly inappropriate but acceptable in most contexts
- medium: clearly inappropriate, should be flagged for review
- high: seriously harmful, should trigger warning
- critical: dangerous/illegal, requires immediate action

## Rules
1. Be calibrated — don't over-flag normal conversation or humor
2. Context matters — medical discussions, news reporting, and education are not violations
3. False positives damage trust — only flag when genuinely concerning
4. Confidence should reflect your certainty (0.0-1.0)

Return ONLY a valid JSON object:
{
  "severity": "none|low|medium|high|critical",
  "categories": ["category1", "category2"],
  "reason": "brief explanation of why this was flagged",
  "confidence": 0.0-1.0,
  "suggested_action": "none|log|flag|warn|delete|mute|ban"
}

No markdown, no explanation outside the JSON.`;

/**
 * Analyze message content for moderation concerns using LLM.
 *
 * @param {object} env
 * @param {{ content: string, projectId: string, roomId: string, userId: string, messageId?: number }} input
 * @returns {Promise<{ ok: true, severity, categories, reason, confidence, suggestedAction } | { ok: false, error: string }>}
 */
export async function analyzeContent(env, input) {
  const { content, projectId, roomId, userId, messageId } = input;

  if (!content || String(content).trim().length < 3) {
    return {
      ok: true,
      severity: "none",
      categories: [],
      reason: "content too short to analyze",
      confidence: 1.0,
      suggestedAction: "none",
    };
  }

  if (!isAiConfigured(env)) {
    return { ok: false, error: "ai_not_configured" };
  }

  const ai = await chatCompletion(env, {
    model: env.AI_MODERATION_MODEL || env.AI_DIGEST_MODEL || env.AI_SUGGEST_MODEL || env.AI_MODEL || "openai/gpt-4o-mini",
    maxTokens: 256,
    temperature: 0.1,
    logContext: { projectId, roomId, feature: "ai_moderation", userId, messageId },
    messages: [
      { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Analyze this message for moderation concerns:\n\nUser: ${userId}\nRoom: ${roomId}\nContent: ${String(content).slice(0, 4000)}`,
      },
    ],
  });

  if (!ai.ok) {
    return { ok: false, error: ai.error };
  }

  let parsed;
  try {
    const text = ai.content.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : '{"severity":"none","categories":[],"reason":"","confidence":0,"suggested_action":"none"}');
  } catch {
    return {
      ok: true,
      severity: "none",
      categories: [],
      reason: "parse_error",
      confidence: 0,
      suggestedAction: "none",
    };
  }

  const validSeverities = ["none", "low", "medium", "high", "critical"];
  const severity = validSeverities.includes(parsed.severity) ? parsed.severity : "none";
  const categories = Array.isArray(parsed.categories)
    ? parsed.categories.filter((c) => MODERATION_CATEGORIES.includes(c))
    : [];
  const validActions = ["none", "log", "flag", "warn", "delete", "mute", "ban"];
  const suggestedAction = validActions.includes(parsed.suggested_action)
    ? parsed.suggested_action
    : SEVERITY_ACTIONS[severity] || "none";

  return {
    ok: true,
    severity,
    categories,
    reason: String(parsed.reason || "").slice(0, 500),
    confidence: Math.min(Math.max(Number(parsed.confidence) || 0.8, 0), 1),
    suggestedAction,
  };
}

/**
 * Queue a moderation event and optionally auto-apply action.
 *
 * @param {object} env
 * @param {{ projectId, roomId, userId, messageId, content, severity, categories, reason, confidence, suggestedAction, autoActionTaken }} input
 * @returns {Promise<{ ok: true, id: string }>}
 */
export async function queueModerationEvent(env, input) {
  const {
    projectId, roomId, userId, messageId, content,
    severity, categories, reason, confidence, suggestedAction, autoActionTaken,
  } = input;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO ai_moderation_queue
     (id, project_id, room_id, message_id, user_id, content, severity, categories, reason, confidence, suggested_action, auto_action_taken, source_message_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id, projectId, roomId, messageId || null, userId,
      String(content || "").slice(0, 4000),
      severity, JSON.stringify(categories), reason,
      confidence, suggestedAction, autoActionTaken || null,
      messageId || null, now, now,
    )
    .run();

  logInfo("ai_moderation.queued", {
    projectId, roomId, userId, severity, suggestedAction, autoActionTaken,
  });

  return { ok: true, id };
}

/**
 * Apply automatic moderation action based on severity.
 *
 * @param {object} env
 * @param {{ projectId, roomId, userId, severity, suggestedAction, messageId }} input
 * @returns {Promise<{ applied: string | null }>}
 */
export async function applyAutoAction(env, input) {
  const { projectId, roomId, userId, severity, suggestedAction, messageId } = input;

  const autoConfig = env.AI_MODERATION_AUTO_ACTIONS || "none,low,log";
  const allowedLevels = autoConfig.split(",").map((s) => s.trim().toLowerCase());

  if (!allowedLevels.includes(severity)) {
    return { applied: null };
  }

  if (suggestedAction === "none" || suggestedAction === "log") {
    return { applied: suggestedAction };
  }

  const now = new Date().toISOString();

  if (suggestedAction === "warn") {
    await env.DB.prepare(
      `INSERT INTO moderation_events (project_id, room_id, user_id, action, reason, created_at, target_message_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(projectId, roomId, userId, "auto_flag", `ai_moderation:${severity}`, now, messageId || null)
      .run();
    return { applied: "warn" };
  }

  if (suggestedAction === "mute") {
    const muteDuration = Number(env.AI_MODERATION_MUTE_DURATION_MINUTES) || 30;
    const expiresAt = new Date(Date.now() + muteDuration * 60_000).toISOString();
    await env.DB.prepare(
      `INSERT INTO moderation_events (project_id, room_id, user_id, action, reason, expires_at, created_at, target_message_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(projectId, roomId, userId, "mute", `ai_moderation:${severity}`, expiresAt, now, messageId || null)
      .run();
    return { applied: "mute" };
  }

  if (suggestedAction === "ban") {
    await env.DB.prepare(
      `INSERT INTO moderation_events (project_id, room_id, user_id, action, reason, created_at, target_message_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(projectId, roomId, userId, "ban", `ai_moderation:${severity}`, now, messageId || null)
      .run();
    return { applied: "ban" };
  }

  if (suggestedAction === "delete") {
    if (messageId) {
      await env.DB.prepare(
        `UPDATE messages SET deleted_at = ? WHERE id = ? AND project_id = ?`
      )
        .bind(now, messageId, projectId)
        .run();
    }
    await env.DB.prepare(
      `INSERT INTO moderation_events (project_id, room_id, user_id, action, reason, created_at, target_message_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(projectId, roomId, userId, "auto_flag", `ai_moderation:delete:${severity}`, now, messageId || null)
      .run();
    return { applied: "delete" };
  }

  if (suggestedAction === "flag") {
    await env.DB.prepare(
      `INSERT INTO moderation_events (project_id, room_id, user_id, action, reason, created_at, target_message_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(projectId, roomId, userId, "auto_flag", `ai_moderation:${severity}`, now, messageId || null)
      .run();
    return { applied: "flag" };
  }

  return { applied: null };
}

/**
 * Human moderator reviews a queued moderation event.
 *
 * @param {object} env
 * @param {{ eventId: string, projectId: string, moderatorId: string, action: "confirm"|"override"|"dismiss", overrideAction?: string, notes?: string }} input
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export async function reviewModerationEvent(env, input) {
  const { eventId, projectId, moderatorId, action, overrideAction, notes } = input;

  const event = await env.DB.prepare(
    "SELECT id, room_id, user_id, message_id, severity, suggested_action FROM ai_moderation_queue WHERE id = ? AND project_id = ?"
  )
    .bind(eventId, projectId)
    .first();

  if (!event) {
    return { ok: false, error: "event_not_found" };
  }

  const now = new Date().toISOString();

  if (action === "dismiss") {
    await env.DB.prepare(
      `UPDATE ai_moderation_queue SET reviewed_by = ?, reviewed_at = ?, review_action = 'dismiss', review_notes = ?, updated_at = ? WHERE id = ?`
    )
      .bind(moderatorId, now, notes || null, now, eventId)
      .run();
    return { ok: true };
  }

  if (action === "confirm") {
    await env.DB.prepare(
      `UPDATE ai_moderation_queue SET reviewed_by = ?, reviewed_at = ?, review_action = 'confirm', review_notes = ?, updated_at = ? WHERE id = ?`
    )
      .bind(moderatorId, now, notes || null, now, eventId)
      .run();

    const finalAction = event.suggested_action;
    if (["warn", "mute", "ban", "delete"].includes(finalAction)) {
      await applyAutoAction(env, {
        projectId,
        roomId: event.room_id,
        userId: event.user_id,
        severity: event.severity,
        suggestedAction: finalAction,
        messageId: event.message_id,
      });
    }
    return { ok: true };
  }

  if (action === "override" && overrideAction) {
    const validActions = ["none", "log", "flag", "warn", "delete", "mute", "ban"];
    if (!validActions.includes(overrideAction)) {
      return { ok: false, error: "invalid_override_action" };
    }

    await env.DB.prepare(
      `UPDATE ai_moderation_queue SET reviewed_by = ?, reviewed_at = ?, review_action = 'override', review_notes = ?, updated_at = ? WHERE id = ?`
    )
      .bind(moderatorId, now, notes || null, now, eventId)
      .run();

    if (["warn", "mute", "ban", "delete"].includes(overrideAction)) {
      await applyAutoAction(env, {
        projectId,
        roomId: event.room_id,
        userId: event.user_id,
        severity: event.severity,
        suggestedAction: overrideAction,
        messageId: event.message_id,
      });
    }
    return { ok: true };
  }

  return { ok: false, error: "invalid_action" };
}

/**
 * Get moderation queue with filters.
 *
 * @param {object} env
 * @param {{ projectId, roomId?, severity?, pending?, limit?, offset? }} input
 * @returns {Promise<{ ok: true, events: Array, total: number }>}
 */
export async function getModerationQueue(env, input) {
  const { projectId, roomId, severity, pending } = input;
  const limit = Math.min(Math.max(Number(input.limit) || 20, 1), 100);
  const offset = Math.max(Number(input.offset) || 0, 0);

  let where = "project_id = ?";
  const params = [projectId];

  if (roomId) {
    where += " AND room_id = ?";
    params.push(roomId);
  }
  if (severity) {
    where += " AND severity = ?";
    params.push(severity);
  }
  if (pending === true) {
    where += " AND reviewed_by IS NULL";
  }

  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM ai_moderation_queue WHERE ${where}`
  )
    .bind(...params)
    .first();

  const rows = await env.DB.prepare(
    `SELECT * FROM ai_moderation_queue WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  )
    .bind(...params, limit, offset)
    .all();

  const events = (rows.results || []).map((r) => ({
    id: r.id,
    projectId: r.project_id,
    roomId: r.room_id,
    messageId: r.message_id,
    userId: r.user_id,
    content: r.content,
    severity: r.severity,
    categories: r.categories ? JSON.parse(r.categories) : [],
    reason: r.reason,
    confidence: r.confidence,
    suggestedAction: r.suggested_action,
    autoActionTaken: r.auto_action_taken,
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at,
    reviewAction: r.review_action,
    reviewNotes: r.review_notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  return { ok: true, events, total: countRow?.cnt || 0 };
}

/**
 * Get moderation stats for dashboard.
 *
 * @param {object} env
 * @param {{ projectId, days?: number }} input
 * @returns {Promise<{ ok: true, stats: object }>}
 */
export async function getModerationStats(env, input) {
  const { projectId } = input;
  const days = Math.min(Math.max(Number(input.days) || 7, 1), 90);
  const since = new Date(Date.now() - days * 86400_000).toISOString();

  const totalRow = await env.DB.prepare(
    "SELECT COUNT(*) AS cnt FROM ai_moderation_queue WHERE project_id = ? AND created_at >= ?"
  )
    .bind(projectId, since)
    .first();

  const severityRows = await env.DB.prepare(
    "SELECT severity, COUNT(*) AS cnt FROM ai_moderation_queue WHERE project_id = ? AND created_at >= ? GROUP BY severity"
  )
    .bind(projectId, since)
    .all();

  const pendingRow = await env.DB.prepare(
    "SELECT COUNT(*) AS cnt FROM ai_moderation_queue WHERE project_id = ? AND reviewed_by IS NULL"
  )
    .bind(projectId)
    .first();

  const categoryRows = await env.DB.prepare(
    "SELECT categories FROM ai_moderation_queue WHERE project_id = ? AND created_at >= ? AND categories != '[]'"
  )
    .bind(projectId, since)
    .all();

  const categoryCounts = {};
  for (const row of (categoryRows.results || [])) {
    try {
      const cats = JSON.parse(row.categories);
      for (const c of cats) {
        categoryCounts[c] = (categoryCounts[c] || 0) + 1;
      }
    } catch { /* skip */ }
  }

  const severityCounts = {};
  for (const row of (severityRows.results || [])) {
    severityCounts[row.severity] = row.cnt;
  }

  return {
    ok: true,
    stats: {
      total: totalRow?.cnt || 0,
      pending: pendingRow?.cnt || 0,
      severityCounts,
      categoryCounts,
      periodDays: days,
    },
  };
}
