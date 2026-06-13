/**
 * P17-B: Escalation Design with SLA + Reminders
 * Multi-tier escalation rules with automated SLA breach scanning and notifications.
 */

const ESCALATION_ROLES = ["owner", "admin", "moderator"];
const ACTIONS = ["notify_supervisor", "reassign", "alert_manager", "notify_room", "create_task"];
const NAME_MAX = 64;
const DESC_MAX = 256;
const MSG_MAX = 1024;

/* ── access control ── */

/**
 * @param {string[] | undefined} roles
 */
export function canManageEscalationRules(roles) {
  if (!Array.isArray(roles)) return false;
  return roles.some((r) => ESCALATION_ROLES.includes(r));
}

/* ── helpers ── */

function generateId() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

function clampTriggerMinutes(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 15;
  return Math.min(7 * 24 * 60, Math.max(1, Math.floor(n)));
}

function clampPriority(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(10, Math.max(-10, Math.floor(n)));
}

function clampMaxRepeats(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(50, Math.max(0, Math.floor(n)));
}

function clampRepeatInterval(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(24 * 60, Math.max(1, Math.floor(n)));
}

/* ── escalation rules ── */

function mapEscalationRuleRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description ?? null,
    enabled: row.enabled === 1,
    priority: row.priority ?? 0,
    triggerAfterMinutes: row.trigger_after_minutes ?? 15,
    action: row.action,
    targetUserId: row.target_user_id ?? null,
    targetRole: row.target_role ?? null,
    notificationMessage: row.notification_message ?? null,
    roomAnnounce: row.room_announce === 1,
    repeatIntervalMinutes: row.repeat_interval_minutes ?? null,
    maxRepeats: row.max_repeats ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * @param {*} env
 * @param {{ projectId: string }} scope
 */
export async function listEscalationRules(env, scope) {
  const rows = await env.DB.prepare(
    `SELECT * FROM escalation_rules WHERE project_id = ? ORDER BY trigger_after_minutes ASC, priority DESC, created_at ASC`,
  )
    .bind(scope.projectId)
    .all();
  return (rows.results || []).map(mapEscalationRuleRow);
}

/**
 * @param {*} env
 * @param {{ projectId: string, ruleId: string }} scope
 */
export async function getEscalationRule(env, scope) {
  const row = await env.DB.prepare(
    `SELECT * FROM escalation_rules WHERE project_id = ? AND id = ?`,
  )
    .bind(scope.projectId, scope.ruleId)
    .first();
  return row ? mapEscalationRuleRow(row) : null;
}

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   name: string,
 *   description?: string,
 *   priority?: number,
 *   triggerAfterMinutes?: number,
 *   action?: string,
 *   targetUserId?: string | null,
 *   targetRole?: string | null,
 *   notificationMessage?: string | null,
 *   roomAnnounce?: boolean,
 *   repeatIntervalMinutes?: number | null,
 *   maxRepeats?: number,
 * }} opts
 */
export async function createEscalationRule(env, opts) {
  const name = typeof opts.name === "string" ? opts.name.trim().slice(0, NAME_MAX) : "";
  if (!name) return { ok: false, error: "name_required" };

  const action = ACTIONS.includes(opts.action) ? opts.action : "notify_supervisor";
  const id = generateId();
  const now = nowIso();
  const priority = clampPriority(opts.priority);
  const triggerAfterMinutes = clampTriggerMinutes(opts.triggerAfterMinutes);
  const maxRepeats = clampMaxRepeats(opts.maxRepeats);
  const repeatIntervalMinutes =
    opts.repeatIntervalMinutes === null ? null : clampRepeatInterval(opts.repeatIntervalMinutes);
  const description =
    typeof opts.description === "string" ? opts.description.trim().slice(0, DESC_MAX) : null;
  const notificationMessage =
    typeof opts.notificationMessage === "string"
      ? opts.notificationMessage.trim().slice(0, MSG_MAX)
      : null;
  const targetUserId =
    typeof opts.targetUserId === "string" && opts.targetUserId.trim()
      ? opts.targetUserId.trim()
      : null;
  const targetRole =
    typeof opts.targetRole === "string" && opts.targetRole.trim()
      ? opts.targetRole.trim()
      : null;
  const roomAnnounce = opts.roomAnnounce === true ? 1 : 0;

  await env.DB.prepare(
    `INSERT INTO escalation_rules
       (id, project_id, name, description, enabled, priority, trigger_after_minutes,
        action, target_user_id, target_role, notification_message, room_announce,
        repeat_interval_minutes, max_repeats, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      opts.projectId,
      name,
      description,
      priority,
      triggerAfterMinutes,
      action,
      targetUserId,
      targetRole,
      notificationMessage,
      roomAnnounce,
      repeatIntervalMinutes,
      maxRepeats,
      now,
      now,
    )
    .run();

  return {
    ok: true,
    rule: mapEscalationRuleRow({
      id,
      project_id: opts.projectId,
      name,
      description,
      enabled: 1,
      priority,
      trigger_after_minutes: triggerAfterMinutes,
      action,
      target_user_id: targetUserId,
      target_role: targetRole,
      notification_message: notificationMessage,
      room_announce: roomAnnounce,
      repeat_interval_minutes: repeatIntervalMinutes,
      max_repeats: maxRepeats,
      created_at: now,
      updated_at: now,
    }),
  };
}

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   ruleId: string,
 *   name?: string,
 *   description?: string | null,
 *   priority?: number,
 *   triggerAfterMinutes?: number,
 *   action?: string,
 *   targetUserId?: string | null,
 *   targetRole?: string | null,
 *   notificationMessage?: string | null,
 *   roomAnnounce?: boolean,
 *   repeatIntervalMinutes?: number | null,
 *   maxRepeats?: number,
 *   enabled?: boolean,
 * }} opts
 */
export async function updateEscalationRule(env, opts) {
  const existing = await getEscalationRule(env, { projectId: opts.projectId, ruleId: opts.ruleId });
  if (!existing) return { ok: false, error: "not_found" };

  const now = nowIso();
  const name =
    typeof opts.name === "string" ? opts.name.trim().slice(0, NAME_MAX) : existing.name;
  if (!name) return { ok: false, error: "name_required" };

  const action = ACTIONS.includes(opts.action) ? opts.action : existing.action;
  const priority =
    opts.priority !== undefined ? clampPriority(opts.priority) : existing.priority;
  const triggerAfterMinutes =
    opts.triggerAfterMinutes !== undefined
      ? clampTriggerMinutes(opts.triggerAfterMinutes)
      : existing.triggerAfterMinutes;
  const maxRepeats =
    opts.maxRepeats !== undefined ? clampMaxRepeats(opts.maxRepeats) : existing.maxRepeats;
  const repeatIntervalMinutes =
    opts.repeatIntervalMinutes === undefined
      ? existing.repeatIntervalMinutes
      : opts.repeatIntervalMinutes === null
        ? null
        : clampRepeatInterval(opts.repeatIntervalMinutes);
  const description =
    opts.description === undefined
      ? existing.description
      : opts.description === null
        ? null
        : typeof opts.description === "string"
          ? opts.description.trim().slice(0, DESC_MAX)
          : null;
  const notificationMessage =
    opts.notificationMessage === undefined
      ? existing.notificationMessage
      : opts.notificationMessage === null
        ? null
        : typeof opts.notificationMessage === "string"
          ? opts.notificationMessage.trim().slice(0, MSG_MAX)
          : null;
  const targetUserId =
    opts.targetUserId === undefined
      ? existing.targetUserId
      : opts.targetUserId === null
        ? null
        : typeof opts.targetUserId === "string" && opts.targetUserId.trim()
          ? opts.targetUserId.trim()
          : null;
  const targetRole =
    opts.targetRole === undefined
      ? existing.targetRole
      : opts.targetRole === null
        ? null
        : typeof opts.targetRole === "string" && opts.targetRole.trim()
          ? opts.targetRole.trim()
          : null;
  const roomAnnounce =
    opts.roomAnnounce !== undefined ? (opts.roomAnnounce ? 1 : 0) : undefined;
  const enabled = typeof opts.enabled === "boolean" ? (opts.enabled ? 1 : 0) : undefined;

  let setClauses = [
    "name = ?",
    "description = ?",
    "priority = ?",
    "trigger_after_minutes = ?",
    "action = ?",
    "target_user_id = ?",
    "target_role = ?",
    "notification_message = ?",
    "repeat_interval_minutes = ?",
    "max_repeats = ?",
    "updated_at = ?",
  ];
  let binds = [
    name,
    description,
    priority,
    triggerAfterMinutes,
    action,
    targetUserId,
    targetRole,
    notificationMessage,
    repeatIntervalMinutes,
    maxRepeats,
    now,
  ];

  if (roomAnnounce !== undefined) {
    setClauses.push("room_announce = ?");
    binds.push(roomAnnounce);
  }
  if (enabled !== undefined) {
    setClauses.push("enabled = ?");
    binds.push(enabled);
  }

  binds.push(opts.projectId, opts.ruleId);
  await env.DB.prepare(
    `UPDATE escalation_rules SET ${setClauses.join(", ")} WHERE project_id = ? AND id = ?`,
  )
    .bind(...binds)
    .run();

  return {
    ok: true,
    rule: mapEscalationRuleRow({
      ...existing,
      name,
      description,
      priority,
      trigger_after_minutes: triggerAfterMinutes,
      action,
      target_user_id: targetUserId,
      target_role: targetRole,
      notification_message: notificationMessage,
      room_announce: roomAnnounce !== undefined ? roomAnnounce : (existing.roomAnnounce ? 1 : 0),
      repeat_interval_minutes: repeatIntervalMinutes,
      max_repeats: maxRepeats,
      enabled: enabled !== undefined ? enabled : (existing.enabled ? 1 : 0),
      updated_at: now,
    }),
  };
}

/**
 * @param {*} env
 * @param {{ projectId: string, ruleId: string }} opts
 */
export async function deleteEscalationRule(env, opts) {
  const result = await env.DB.prepare(
    `DELETE FROM escalation_rules WHERE project_id = ? AND id = ?`,
  )
    .bind(opts.projectId, opts.ruleId)
    .run();
  if (!result.meta?.changes) return { ok: false, error: "not_found" };
  return { ok: true };
}

/* ── escalation events ── */

function mapEscalationEventRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    roomId: row.room_id,
    taskId: row.task_id,
    ruleId: row.rule_id,
    tierIndex: row.tier_index ?? 0,
    action: row.action,
    targetUserId: row.target_user_id ?? null,
    triggeredAt: row.triggered_at,
    resolvedAt: row.resolved_at ?? null,
    repeatCount: row.repeat_count ?? 0,
    notificationSent: row.notification_sent === 1,
    error: row.error ?? null,
    createdAt: row.created_at,
  };
}

/**
 * @param {*} env
 * @param {{ projectId: string, taskId?: string }} scope
 */
export async function listEscalationEvents(env, scope) {
  let query = `SELECT * FROM escalation_events WHERE project_id = ?`;
  const binds = [scope.projectId];

  if (scope.taskId) {
    query += ` AND task_id = ?`;
    binds.push(scope.taskId);
  }

  query += ` ORDER BY triggered_at DESC LIMIT 100`;

  const rows = await env.DB.prepare(query).bind(...binds).all();
  return (rows.results || []).map(mapEscalationEventRow);
}

/**
 * @param {*} env
 * @param {{ projectId: string }} scope
 */
export async function getEscalationStats(env, scope) {
  const actionRows = await env.DB.prepare(
    `SELECT action, COUNT(*) AS cnt FROM escalation_events
     WHERE project_id = ? GROUP BY action`,
  )
    .bind(scope.projectId)
    .all();

  const pendingRows = await env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM escalation_events
     WHERE project_id = ? AND resolved_at IS NULL`,
  )
    .bind(scope.projectId)
    .first();

  const totalRows = await env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM escalation_events WHERE project_id = ?`,
  )
    .bind(scope.projectId)
    .first();

  const ruleRows = await env.DB.prepare(
    `SELECT COUNT(*) AS total, SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) AS active
     FROM escalation_rules WHERE project_id = ?`,
  )
    .bind(scope.projectId)
    .first();

  const actionCounts = {};
  for (const r of actionRows.results || []) actionCounts[r.action] = r.cnt;

  return {
    events: {
      total: totalRows?.cnt ?? 0,
      pending: pendingRows?.cnt ?? 0,
      byAction: actionCounts,
    },
    rules: {
      total: ruleRows?.total ?? 0,
      active: ruleRows?.active ?? 0,
    },
  };
}

/* ── escalation engine ── */

/**
 * Find escalation rules that should fire for a given task age.
 * @param {*} env
 * @param {{ projectId: string, taskAgeMinutes: number }} opts
 * @returns {Promise<Array>} rules sorted by trigger time
 */
export async function findTriggeredRules(env, opts) {
  const rows = await env.DB.prepare(
    `SELECT * FROM escalation_rules
     WHERE project_id = ? AND enabled = 1
       AND trigger_after_minutes <= ?
     ORDER BY trigger_after_minutes ASC, priority DESC`,
  )
    .bind(opts.projectId, opts.taskAgeMinutes)
    .all();
  return (rows.results || []).map(mapEscalationRuleRow);
}

/**
 * Check if an escalation event already exists for a given task + rule + repeat count.
 * @param {*} env
 * @param {{ projectId: string, taskId: string, ruleId: string, repeatCount: number }} opts
 */
export async function hasEscalationEvent(env, opts) {
  const row = await env.DB.prepare(
    `SELECT 1 AS ok FROM escalation_events
     WHERE project_id = ? AND task_id = ? AND rule_id = ? AND repeat_count = ? LIMIT 1`,
  )
    .bind(opts.projectId, opts.taskId, opts.ruleId, opts.repeatCount)
    .first();
  return Boolean(row?.ok);
}

/**
 * Record an escalation event.
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   roomId: string,
 *   taskId: string,
 *   ruleId: string,
 *   tierIndex: number,
 *   action: string,
 *   targetUserId?: string | null,
 *   repeatCount?: number,
 * }} opts
 */
export async function recordEscalationEvent(env, opts) {
  const now = nowIso();
  const id = generateId();

  await env.DB.prepare(
    `INSERT INTO escalation_events
       (id, project_id, room_id, task_id, rule_id, tier_index, action, target_user_id,
        triggered_at, resolved_at, repeat_count, notification_sent, error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 0, NULL, ?)`,
  )
    .bind(
      id,
      opts.projectId,
      opts.roomId,
      opts.taskId,
      opts.ruleId,
      opts.tierIndex ?? 0,
      opts.action,
      opts.targetUserId ?? null,
      now,
      opts.repeatCount ?? 0,
      now,
    )
    .run();

  return {
    id,
    triggeredAt: now,
  };
}

/**
 * Mark an escalation event as resolved.
 * @param {*} env
 * @param {{ eventId: string, projectId: string }} opts
 */
export async function resolveEscalationEvent(env, opts) {
  const now = nowIso();
  await env.DB.prepare(
    `UPDATE escalation_events SET resolved_at = ? WHERE id = ? AND project_id = ?`,
  )
    .bind(now, opts.eventId, opts.projectId)
    .run();
  return { ok: true, resolvedAt: now };
}

/**
 * Process escalation for a single task. Finds applicable rules, checks for duplicates,
 * executes actions, and records events.
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   task: { id: string, room_id: string, created_at: string, assignee_user_id?: string | null },
 * }} opts
 * @returns {Promise<{ processed: number, actions: Array }>}
 */
export async function processTaskEscalation(env, opts) {
  const taskCreatedAt = Date.parse(opts.task.created_at);
  const now = Date.now();
  const taskAgeMinutes = Math.max(0, Math.floor((now - taskCreatedAt) / 60_000));

  const triggeredRules = await findTriggeredRules(env, {
    projectId: opts.projectId,
    taskAgeMinutes,
  });

  if (!triggeredRules.length) return { processed: 0, actions: [] };

  const actions = [];
  let tierIndex = 0;

  for (const rule of triggeredRules) {
    const alreadyFired = await hasEscalationEvent(env, {
      projectId: opts.projectId,
      taskId: opts.task.id,
      ruleId: rule.id,
      repeatCount: 0,
    });

    if (alreadyFired) {
      if (rule.repeatIntervalMinutes && rule.maxRepeats > 0) {
        const lastEvent = await getLastEscalationEvent(env, {
          projectId: opts.projectId,
          taskId: opts.task.id,
          ruleId: rule.id,
        });
        if (lastEvent) {
          const lastTriggered = Date.parse(lastEvent.triggered_at);
          const elapsed = Math.floor((now - lastTriggered) / 60_000);
          if (elapsed >= rule.repeatIntervalMinutes && lastEvent.repeat_count < rule.maxRepeats) {
            const newRepeatCount = lastEvent.repeat_count + 1;
            const event = await recordEscalationEvent(env, {
              projectId: opts.projectId,
              roomId: opts.task.room_id,
              taskId: opts.task.id,
              ruleId: rule.id,
              tierIndex,
              action: rule.action,
              targetUserId: rule.targetUserId,
              repeatCount: newRepeatCount,
            });
            actions.push({
              ruleId: rule.id,
              ruleName: rule.name,
              action: rule.action,
              targetUserId: rule.targetUserId,
              targetRole: rule.targetRole,
              repeatCount: newRepeatCount,
              eventId: event.id,
              triggeredAt: event.triggeredAt,
            });
          }
        }
      }
      tierIndex++;
      continue;
    }

    const event = await recordEscalationEvent(env, {
      projectId: opts.projectId,
      roomId: opts.task.room_id,
      taskId: opts.task.id,
      ruleId: rule.id,
      tierIndex,
      action: rule.action,
      targetUserId: rule.targetUserId,
      repeatCount: 0,
    });

    actions.push({
      ruleId: rule.id,
      ruleName: rule.name,
      action: rule.action,
      targetUserId: rule.targetUserId,
      targetRole: rule.targetRole,
      repeatCount: 0,
      eventId: event.id,
      triggeredAt: event.triggeredAt,
    });

    tierIndex++;
  }

  return { processed: actions.length, actions };
}

/**
 * Get the last escalation event for a task + rule.
 * @param {*} env
 * @param {{ projectId: string, taskId: string, ruleId: string }} opts
 */
async function getLastEscalationEvent(env, opts) {
  const row = await env.DB.prepare(
    `SELECT * FROM escalation_events
     WHERE project_id = ? AND task_id = ? AND rule_id = ?
     ORDER BY triggered_at DESC LIMIT 1`,
  )
    .bind(opts.projectId, opts.taskId, opts.ruleId)
    .first();
  return row || null;
}

/**
 * Run batch escalation scan across all active tasks.
 * @param {*} env
 * @param {{ projectId?: string }} opts
 * @returns {Promise<{ scanned: number, escalated: number, details: Array }>}
 */
export async function runEscalationScan(env, opts = {}) {
  let query = `
    SELECT t.id, t.room_id, t.project_id, t.created_at, t.assignee_user_id, t.status
    FROM agent_tasks t
    WHERE t.status IN ('open', 'claimed')`;
  const binds = [];

  if (opts.projectId) {
    query += ` AND t.project_id = ?`;
    binds.push(opts.projectId);
  }

  query += ` ORDER BY t.created_at ASC LIMIT 200`;

  const rows = await env.DB.prepare(query).bind(...binds).all();
  const tasks = rows.results || [];

  let escalated = 0;
  const details = [];

  for (const task of tasks) {
    const result = await processTaskEscalation(env, {
      projectId: task.project_id,
      task: {
        id: task.id,
        room_id: task.room_id,
        created_at: task.created_at,
        assignee_user_id: task.assignee_user_id,
      },
    });

    if (result.processed > 0) {
      escalated += result.processed;
      details.push({
        taskId: task.id,
        roomId: task.room_id,
        projectId: task.project_id,
        actions: result.actions,
      });
    }
  }

  return { scanned: tasks.length, escalated, details };
}
