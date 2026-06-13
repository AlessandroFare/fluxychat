/**
 * P15-J: Autonomous Moderation
 *
 * Auto-action engine that takes actions on messages based on AI moderation
 * severity + confidence thresholds. Actions: warn, mute, timeout, kick,
 * ban, quarantine, flag_only. Includes cooldown, rate limiting, appeal flow,
 * and admin notification.
 *
 * Compounds:
 * - P16-E (AI Semantic Moderation) for severity analysis
 * - P17-E (Moderation Queue) for priority scoring
 */

import { logInfo } from "./worker-log.js";

/**
 * Create or update an auto-rule.
 */
export async function upsertAutoRule(env, input) {
  const { projectId, id, name, description, severityMin, confidenceMin, action, muteDurationMinutes, timeoutDurationMinutes, cooldownMinutes, maxActionsPerHour, notifyAdmins, notifyUser, appealEnabled } = input;
  if (!name?.trim()) return { ok: false, error: "name_required" };

  const validActions = ["log", "warn", "mute", "timeout", "kick", "ban", "quarantine", "flag_only"];
  if (action && !validActions.includes(action)) return { ok: false, error: "invalid_action" };

  const ruleId = id || crypto.randomUUID();
  const now = new Date().toISOString();

  if (id) {
    await env.DB.prepare(
      `UPDATE moderation_auto_rules SET name = ?, description = ?, severity_min = ?, confidence_min = ?,
       action = ?, mute_duration_minutes = ?, timeout_duration_minutes = ?, cooldown_minutes = ?,
       max_actions_per_hour = ?, notify_admins = ?, notify_user = ?, appeal_enabled = ?, updated_at = ?
       WHERE id = ? AND project_id = ?`
    )
      .bind(name.trim(), description || null, severityMin || "high", confidenceMin || 0.8,
        action || "warn", muteDurationMinutes || 30, timeoutDurationMinutes || 60,
        cooldownMinutes || 5, maxActionsPerHour || 10, notifyAdmins ? 1 : 0, notifyUser ? 1 : 0,
        appealEnabled ? 1 : 0, now, ruleId, projectId)
      .run();
  } else {
    await env.DB.prepare(
      `INSERT INTO moderation_auto_rules (id, project_id, name, description, severity_min, confidence_min,
       action, mute_duration_minutes, timeout_duration_minutes, cooldown_minutes, max_actions_per_hour,
       notify_admins, notify_user, appeal_enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(ruleId, projectId, name.trim(), description || null, severityMin || "high", confidenceMin || 0.8,
        action || "warn", muteDurationMinutes || 30, timeoutDurationMinutes || 60,
        cooldownMinutes || 5, maxActionsPerHour || 10, notifyAdmins ? 1 : 0, notifyUser ? 1 : 0,
        appealEnabled ? 1 : 0, now, now)
      .run();
  }

  return { ok: true, id: ruleId };
}

/**
 * List auto-rules for a project.
 */
export async function listAutoRules(env, { projectId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM moderation_auto_rules WHERE project_id = ? ORDER BY created_at DESC"
  )
    .bind(projectId)
    .all();

  return {
    ok: true,
    rules: (rows.results || []).map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isActive: !!r.is_active,
      severityMin: r.severity_min,
      confidenceMin: r.confidence_min,
      action: r.action,
      muteDurationMinutes: r.mute_duration_minutes,
      timeoutDurationMinutes: r.timeout_duration_minutes,
      cooldownMinutes: r.cooldown_minutes,
      maxActionsPerHour: r.max_actions_per_hour,
      notifyAdmins: !!r.notify_admins,
      notifyUser: !!r.notify_user,
      appealEnabled: !!r.appeal_enabled,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  };
}

/**
 * Evaluate a moderation event against auto-rules and take action.
 */
export async function evaluateAndAct(env, input) {
  const { projectId, roomId, userId, messageId, severity, confidence, reason, aiRawResponse } = input;
  if (!severity || !confidence) return { ok: false, error: "severity_and_confidence_required" };

  // Get matching rules
  const rules = await env.DB.prepare(
    "SELECT * FROM moderation_auto_rules WHERE project_id = ? AND is_active = 1"
  )
    .bind(projectId)
    .all();

  const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
  const matchedRules = [];

  for (const rule of rules.results || []) {
    if (severityOrder[severity] >= severityOrder[rule.severity_min] && confidence >= rule.confidence_min) {
      matchedRules.push(rule);
    }
  }

  if (matchedRules.length === 0) {
    return { ok: true, action: "none", matchedRules: 0 };
  }

  // Pick highest-severity rule
  matchedRules.sort((a, b) => (severityOrder[b.severity_min] || 0) - (severityOrder[a.severity_min] || 0));
  const rule = matchedRules[0];

  // Check cooldown
  const recentAction = await env.DB.prepare(
    "SELECT id FROM moderation_auto_actions WHERE project_id = ? AND user_id = ? AND applied_at > datetime('now', ?)"
  )
    .bind(projectId, userId, `-${rule.cooldown_minutes} minutes`)
    .first();

  if (recentAction) {
    return { ok: true, action: "cooldown", cooldownMinutes: rule.cooldown_minutes };
  }

  // Check rate limit
  const hourlyCount = await env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM moderation_auto_actions WHERE project_id = ? AND user_id = ? AND applied_at > datetime('now', '-60 minutes')"
  )
    .bind(projectId, userId)
    .first();

  if ((hourlyCount?.cnt || 0) >= rule.max_actions_per_hour) {
    return { ok: true, action: "rate_limited", maxPerHour: rule.max_actions_per_hour };
  }

  // Calculate expiry
  let expiresAt = null;
  if (rule.action === "mute") {
    expiresAt = new Date(Date.now() + (rule.mute_duration_minutes || 30) * 60000).toISOString();
  } else if (rule.action === "timeout") {
    expiresAt = new Date(Date.now() + (rule.timeout_duration_minutes || 60) * 60000).toISOString();
  }

  // Record action
  const actionId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO moderation_auto_actions (id, project_id, room_id, user_id, message_id, rule_id, action, severity, confidence, reason, ai_raw_response, applied_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(actionId, projectId, roomId, userId, messageId || null, rule.id, rule.action, severity, confidence, reason || null, aiRawResponse || null, new Date().toISOString(), expiresAt)
    .run();

  logInfo("moderation.auto_action", { projectId, roomId, userId, action: rule.action, severity, confidence, ruleId: rule.id });

  return {
    ok: true,
    action: rule.action,
    actionId,
    expiresAt,
    notifyAdmins: !!rule.notify_admins,
    notifyUser: !!rule.notify_user,
    appealEnabled: !!rule.appeal_enabled,
  };
}

/**
 * Get auto-action history for a project/user.
 */
export async function getAutoActionHistory(env, input) {
  const { projectId, userId, roomId, limit = 50 } = input;

  let sql = "SELECT * FROM moderation_auto_actions WHERE project_id = ?";
  const params = [projectId];

  if (userId) {
    sql += " AND user_id = ?";
    params.push(userId);
  }
  if (roomId) {
    sql += " AND room_id = ?";
    params.push(roomId);
  }

  sql += " ORDER BY applied_at DESC LIMIT ?";
  params.push(limit);

  const rows = await env.DB.prepare(sql).bind(...params).all();

  return {
    ok: true,
    actions: (rows.results || []).map((r) => ({
      id: r.id,
      roomId: r.room_id,
      userId: r.user_id,
      messageId: r.message_id,
      ruleId: r.rule_id,
      action: r.action,
      severity: r.severity,
      confidence: r.confidence,
      reason: r.reason,
      appliedAt: r.applied_at,
      expiresAt: r.expires_at,
      appealed: !!r.appealed,
      appealResult: r.appeal_result,
    })),
  };
}

/**
 * Appeal an auto-action.
 */
export async function appealAutoAction(env, input) {
  const { projectId, actionId, userId } = input;
  if (!actionId) return { ok: false, error: "action_id_required" };

  const action = await env.DB.prepare(
    "SELECT * FROM moderation_auto_actions WHERE id = ? AND project_id = ?"
  )
    .bind(actionId, projectId)
    .first();

  if (!action) return { ok: false, error: "action_not_found" };
  if (action.appealed) return { ok: false, error: "already_appealed" };
  if (action.user_id !== userId) return { ok: false, error: "not_your_action" };

  // Check if appeal is enabled for the rule
  if (action.rule_id) {
    const rule = await env.DB.prepare("SELECT appeal_enabled FROM moderation_auto_rules WHERE id = ?")
      .bind(action.rule_id)
      .first();
    if (rule && !rule.appeal_enabled) return { ok: false, error: "appeals_disabled" };
  }

  await env.DB.prepare(
    "UPDATE moderation_auto_actions SET appealed = 1, appeal_result = 'pending', appeal_at = ? WHERE id = ?"
  )
    .bind(new Date().toISOString(), actionId)
    .run();

  return { ok: true };
}

/**
 * Get auto-moderation stats.
 */
export async function getAutoModStats(env, { projectId }) {
  const totalResult = await env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM moderation_auto_actions WHERE project_id = ?"
  )
    .bind(projectId)
    .first();

  const byActionResult = await env.DB.prepare(
    "SELECT action, COUNT(*) as cnt FROM moderation_auto_actions WHERE project_id = ? GROUP BY action"
  )
    .bind(projectId)
    .all();

  const bySeverityResult = await env.DB.prepare(
    "SELECT severity, COUNT(*) as cnt FROM moderation_auto_actions WHERE project_id = ? GROUP BY severity"
  )
    .bind(projectId)
    .all();

  const appealsResult = await env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM moderation_auto_actions WHERE project_id = ? AND appealed = 1"
  )
    .bind(projectId)
    .first();

  const activeRules = await env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM moderation_auto_rules WHERE project_id = ? AND is_active = 1"
  )
    .bind(projectId)
    .first();

  return {
    ok: true,
    totalActions: totalResult?.cnt || 0,
    byAction: Object.fromEntries((byActionResult.results || []).map((r) => [r.action, r.cnt])),
    bySeverity: Object.fromEntries((bySeverityResult.results || []).map((r) => [r.severity, r.cnt])),
    totalAppeals: appealsResult?.cnt || 0,
    activeRules: activeRules?.cnt || 0,
  };
}
