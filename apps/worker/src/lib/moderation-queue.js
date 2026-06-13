/**
 * P17-E: AI Moderation Queue + Review Enhancements
 * Priority scoring, bulk actions, SLA tracking, and false-positive feedback loop.
 */

const MODERATION_ROLES = ["owner", "admin", "moderator"];
const FEEDBACK_TYPES = ["true_positive", "false_positive", "uncertain"];
const VALID_SEVERITIES = ["none", "low", "medium", "high", "critical"];
const VALID_ACTIONS = ["none", "log", "flag", "warn", "delete", "mute", "ban"];

const SEVERITY_WEIGHT = { none: 0, low: 1, medium: 3, high: 7, critical: 10 };

function generateId() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

function computePriorityScore(severity, confidence, createdAt) {
  const sv = SEVERITY_WEIGHT[severity] ?? 0;
  const conf = Math.min(Math.max(Number(confidence) || 0.8, 0), 1);
  const ageMinutes = (Date.now() - new Date(createdAt).getTime()) / 60_000;
  const ageBonus = Math.min(ageMinutes / 60, 5);
  return Math.round((sv * 10 + conf * 5 + ageBonus) * 100) / 100;
}

function mapQueueEvent(row) {
  return {
    id: row.id, projectId: row.project_id, roomId: row.room_id,
    messageId: row.message_id, userId: row.user_id, content: row.content,
    severity: row.severity,
    categories: (() => { try { return JSON.parse(row.categories || "[]"); } catch { return []; } })(),
    reason: row.reason, confidence: row.confidence,
    suggestedAction: row.suggested_action, autoActionTaken: row.auto_action_taken,
    reviewedBy: row.reviewed_by, reviewedAt: row.reviewed_at,
    reviewAction: row.review_action, reviewNotes: row.review_notes,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapFeedback(row) {
  return {
    id: row.id, projectId: row.project_id, queueEventId: row.queue_event_id,
    moderatorId: row.moderator_id, feedbackType: row.feedback_type,
    reason: row.reason,
    categoryAccuracy: (() => { try { return JSON.parse(row.category_accuracy || "{}"); } catch { return {}; } })(),
    createdAt: row.created_at,
  };
}

function mapSlaConfig(row) {
  return {
    id: row.id, projectId: row.project_id, severity: row.severity,
    slaMinutes: row.sla_minutes, escalationEnabled: row.escalation_enabled === 1,
    escalationSeverity: row.escalation_severity, enabled: row.enabled === 1,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapSlaBreach(row) {
  return {
    id: row.id, projectId: row.project_id, queueEventId: row.queue_event_id,
    severity: row.severity, slaMinutes: row.sla_minutes,
    breachedAt: row.breached_at, escalatedTo: row.escalated_to,
    resolvedAt: row.resolved_at, createdAt: row.created_at,
  };
}

/* ── access control ── */

export function canModerateQueue(roles) {
  if (!Array.isArray(roles)) return false;
  return roles.some((r) => MODERATION_ROLES.includes(r));
}

/* ── priority queue ── */

export async function getPriorityQueue(env, { projectId, roomId, severity, pending, limit = 20, offset = 0 }) {
  let where = "project_id = ?";
  const params = [projectId];
  if (roomId) { where += " AND room_id = ?"; params.push(roomId); }
  if (severity) { where += " AND severity = ?"; params.push(severity); }
  if (pending) { where += " AND reviewed_by IS NULL"; }

  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM ai_moderation_queue WHERE ${where}`
  ).bind(...params).first();

  const rows = await env.DB.prepare(
    `SELECT * FROM ai_moderation_queue WHERE ${where}`
  ).bind(...params).all();

  const events = (rows.results || []).map((r) => {
    const mapped = mapQueueEvent(r);
    mapped.priorityScore = computePriorityScore(r.severity, r.confidence, r.created_at);
    return mapped;
  });

  events.sort((a, b) => b.priorityScore - a.priorityScore);
  const paged = events.slice(offset, offset + limit);

  return { ok: true, events: paged, total: countRow?.cnt || 0 };
}

/* ── bulk actions ── */

export async function bulkReviewEvents(env, { projectId, eventIds, moderatorId, action, overrideAction, notes }) {
  if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
    return { ok: false, error: "eventIds_required" };
  }
  if (!["confirm", "override", "dismiss"].includes(action)) {
    return { ok: false, error: "invalid_action" };
  }
  if (action === "override" && !VALID_ACTIONS.includes(overrideAction)) {
    return { ok: false, error: "invalid_override_action" };
  }

  const now = nowIso();
  let processed = 0;
  let failed = 0;

  for (const eventId of eventIds) {
    const event = await env.DB.prepare(
      "SELECT id, room_id, user_id, message_id, severity, suggested_action FROM ai_moderation_queue WHERE id = ? AND project_id = ?"
    ).bind(eventId, projectId).first();

    if (!event) { failed++; continue; }

    const finalAction = action === "override" ? overrideAction : (action === "confirm" ? event.suggested_action : null);

    await env.DB.prepare(
      `UPDATE ai_moderation_queue SET reviewed_by = ?, reviewed_at = ?, review_action = ?, review_notes = ?, updated_at = ? WHERE id = ?`
    ).bind(moderatorId, now, action, notes || null, now, eventId).run();

    if (["warn", "mute", "ban", "delete"].includes(finalAction)) {
      await env.DB.prepare(
        `INSERT INTO moderation_events (project_id, room_id, user_id, action, reason, created_at, target_message_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(projectId, event.room_id, event.user_id, finalAction === "delete" ? "auto_flag" : finalAction, `bulk_review:${action}`, now, event.message_id || null).run();

      if (finalAction === "delete" && event.message_id) {
        await env.DB.prepare(
          `UPDATE messages SET deleted_at = ? WHERE id = ? AND project_id = ?`
        ).bind(now, event.message_id, projectId).run();
      }
    }

    processed++;
  }

  return { ok: true, processed, failed };
}

/* ── false-positive feedback loop ── */

export async function submitFeedback(env, { projectId, queueEventId, moderatorId, feedbackType, reason, categoryAccuracy }) {
  if (!FEEDBACK_TYPES.includes(feedbackType)) {
    return { ok: false, error: "invalid_feedback_type" };
  }

  const event = await env.DB.prepare(
    "SELECT id FROM ai_moderation_queue WHERE id = ? AND project_id = ?"
  ).bind(queueEventId, projectId).first();
  if (!event) return { ok: false, error: "event_not_found" };

  const existing = await env.DB.prepare(
    "SELECT id FROM moderation_feedback WHERE queue_event_id = ? AND moderator_id = ?"
  ).bind(queueEventId, moderatorId).first();
  if (existing) return { ok: false, error: "feedback_already_submitted" };

  const id = generateId();
  const createdAt = nowIso();

  await env.DB.prepare(
    `INSERT INTO moderation_feedback (id, project_id, queue_event_id, moderator_id, feedback_type, reason, category_accuracy, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, queueEventId, moderatorId, feedbackType, reason || null, JSON.stringify(categoryAccuracy || {}), createdAt).run();

  return { ok: true, id };
}

export async function getFeedbackStats(env, { projectId, days = 30 }) {
  const since = new Date(Date.now() - days * 86400_000).toISOString();

  const rows = await env.DB.prepare(
    `SELECT feedback_type, COUNT(*) as count FROM moderation_feedback WHERE project_id = ? AND created_at >= ? GROUP BY feedback_type`
  ).bind(projectId, since).all();

  const stats = { truePositive: 0, falsePositive: 0, uncertain: 0, total: 0 };
  for (const row of rows.results || []) {
    if (row.feedback_type === "true_positive") stats.truePositive = row.count;
    else if (row.feedback_type === "false_positive") stats.falsePositive = row.count;
    else if (row.feedback_type === "uncertain") stats.uncertain = row.count;
    stats.total += row.count;
  }

  stats.falsePositiveRate = stats.total > 0 ? stats.falsePositive / stats.total : 0;
  stats.accuracyRate = stats.total > 0 ? stats.truePositive / stats.total : 0;

  const categoryRows = await env.DB.prepare(
    `SELECT category_accuracy FROM moderation_feedback WHERE project_id = ? AND created_at >= ? AND category_accuracy != '{}'`
  ).bind(projectId, since).all();

  const categoryAccuracy = {};
  for (const row of categoryRows.results || []) {
    try {
      const cats = JSON.parse(row.category_accuracy);
      for (const [cat, accurate] of Object.entries(cats)) {
        if (!categoryAccuracy[cat]) categoryAccuracy[cat] = { correct: 0, total: 0 };
        categoryAccuracy[cat].total++;
        if (accurate) categoryAccuracy[cat].correct++;
      }
    } catch { /* skip */ }
  }

  return { ok: true, stats, categoryAccuracy };
}

/* ── SLA config ── */

export async function getSlaConfigs(env, { projectId }) {
  const rows = await env.DB.prepare(
    `SELECT * FROM moderation_sla_config WHERE project_id = ? ORDER BY severity`
  ).bind(projectId).all();
  return (rows.results || []).map(mapSlaConfig);
}

export async function upsertSlaConfig(env, { projectId, severity, slaMinutes, escalationEnabled, escalationSeverity }) {
  if (!VALID_SEVERITIES.includes(severity)) return { ok: false, error: "invalid_severity" };

  const now = nowIso();
  const id = generateId();
  const sla = Math.min(Math.max(Math.floor(Number(slaMinutes) || 60), 5), 1440);

  await env.DB.prepare(
    `INSERT INTO moderation_sla_config (id, project_id, severity, sla_minutes, escalation_enabled, escalation_severity, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT(project_id, severity) DO UPDATE SET
       sla_minutes = excluded.sla_minutes, escalation_enabled = excluded.escalation_enabled,
       escalation_severity = excluded.escalation_severity, updated_at = excluded.updated_at`
  ).bind(id, projectId, severity, sla, escalationEnabled ? 1 : 0, escalationSeverity || null, now, now).run();

  return { ok: true, id };
}

/* ── SLA breach scanning ── */

export async function scanSlaBreaches(env, { projectId }) {
  const configs = await env.DB.prepare(
    `SELECT * FROM moderation_sla_config WHERE project_id = ? AND enabled = 1`
  ).bind(projectId).all();

  const now = nowIso();
  let breached = 0;

  for (const cfg of configs.results || []) {
    const cutoff = new Date(Date.now() - cfg.sla_minutes * 60_000).toISOString();

    const pending = await env.DB.prepare(
      `SELECT id, created_at FROM ai_moderation_queue
       WHERE project_id = ? AND severity = ? AND reviewed_by IS NULL AND created_at < ?`
    ).bind(projectId, cfg.severity, cutoff).all();

    for (const event of pending.results || []) {
      const existing = await env.DB.prepare(
        `SELECT id FROM moderation_sla_breaches WHERE queue_event_id = ?`
      ).bind(event.id).first();
      if (existing) continue;

      const breachId = generateId();
      await env.DB.prepare(
        `INSERT INTO moderation_sla_breaches (id, project_id, queue_event_id, severity, sla_minutes, breached_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(breachId, projectId, event.id, cfg.severity, cfg.sla_minutes, now, now).run();

      if (cfg.escalation_enabled && cfg.escalation_severity) {
        await env.DB.prepare(
          `INSERT INTO moderation_events (project_id, room_id, user_id, action, reason, created_at, target_message_id)
           SELECT project_id, room_id, user_id, 'auto_flag', 'sla_breach:' || ?, created_at, message_id
           FROM ai_moderation_queue WHERE id = ?`
        ).bind(cfg.escalation_severity, event.id).run();
      }

      breached++;
    }
  }

  return { ok: true, breached };
}

export async function getUnresolvedBreaches(env, { projectId, limit = 50 }) {
  const rows = await env.DB.prepare(
    `SELECT * FROM moderation_sla_breaches WHERE project_id = ? AND resolved_at IS NULL ORDER BY breached_at DESC LIMIT ?`
  ).bind(projectId, limit).all();
  return (rows.results || []).map(mapSlaBreach);
}

export async function resolveBreach(env, { projectId, breachId }) {
  const now = nowIso();
  const result = await env.DB.prepare(
    `UPDATE moderation_sla_breaches SET resolved_at = ? WHERE id = ? AND project_id = ? AND resolved_at IS NULL`
  ).bind(now, breachId, projectId).run();
  return { ok: true, resolved: (result.meta?.changes || 0) > 0 };
}

/* ── review history ── */

export async function getReviewHistory(env, { projectId, moderatorId, limit = 50, offset = 0 }) {
  let where = "project_id = ? AND reviewed_by IS NOT NULL";
  const params = [projectId];
  if (moderatorId) { where += " AND reviewed_by = ?"; params.push(moderatorId); }
  params.push(limit, offset);

  const rows = await env.DB.prepare(
    `SELECT * FROM ai_moderation_queue WHERE ${where} ORDER BY reviewed_at DESC LIMIT ? OFFSET ?`
  ).bind(...params).all();
  return (rows.results || []).map(mapQueueEvent);
}
