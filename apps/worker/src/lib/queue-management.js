/**
 * P17-A: Queue Management + Workload Balancing
 * Intelligent chat-agent assignment with routing strategies and capacity tracking.
 */

const QUEUE_MANAGEMENT_ROLES = ["owner", "admin", "moderator"];
const STRATEGIES = ["first_responder", "round_robin", "skill_based", "least_busy", "manual"];
const NAME_MAX = 64;
const DESC_MAX = 256;
const CAPS_MAX = 1024;
const CAPS_MAX_CONCURRENT_MIN = 1;
const CAPS_MAX_CONCURRENT_MAX = 50;

/* ── access control ── */

/**
 * @param {string[] | undefined} roles
 */
export function canManageQueueRules(roles) {
  if (!Array.isArray(roles)) return false;
  return roles.some((r) => QUEUE_MANAGEMENT_ROLES.includes(r));
}

/* ── helpers ── */

function generateId() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

function clampMaxConcurrent(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 5;
  return Math.min(CAPS_MAX_CONCURRENT_MAX, Math.max(CAPS_MAX_CONCURRENT_MIN, Math.floor(n)));
}

function clampPriority(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(10, Math.max(-10, Math.floor(n)));
}

function clampSlaMinutes(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 15;
  return Math.min(24 * 60, Math.max(1, Math.floor(n)));
}

function parseJsonArray(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === "string" && x.trim());
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === "string" && x.trim());
    } catch {}
  }
  return [];
}

function serializeJsonArray(arr) {
  if (!arr || !arr.length) return null;
  return JSON.stringify(arr);
}

/* ── queue rules ── */

function mapQueueRuleRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description ?? null,
    strategy: row.strategy,
    priority: row.priority ?? 0,
    slaMinutes: row.sla_minutes ?? 15,
    escalationSlaMinutes: row.escalation_sla_minutes ?? 30,
    requiredCapabilities: parseJsonArray(row.required_capabilities),
    fallbackStrategy: row.fallback_strategy ?? null,
    fallbackAgentUserId: row.fallback_agent_user_id ?? null,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * @param {*} env
 * @param {{ projectId: string }} scope
 */
export async function listQueueRules(env, scope) {
  const rows = await env.DB.prepare(
    `SELECT * FROM queue_rules WHERE project_id = ? ORDER BY priority DESC, created_at ASC`
  )
    .bind(scope.projectId)
    .all();
  return (rows.results || []).map(mapQueueRuleRow);
}

/**
 * @param {*} env
 * @param {{ projectId: string, ruleId: string }} scope
 */
export async function getQueueRule(env, scope) {
  const row = await env.DB.prepare(
    `SELECT * FROM queue_rules WHERE project_id = ? AND id = ?`
  )
    .bind(scope.projectId, scope.ruleId)
    .first();
  return row ? mapQueueRuleRow(row) : null;
}

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   name: string,
 *   description?: string,
 *   strategy?: string,
 *   priority?: number,
 *   slaMinutes?: number,
 *   escalationSlaMinutes?: number,
 *   requiredCapabilities?: string[],
 *   fallbackStrategy?: string | null,
 *   fallbackAgentUserId?: string | null,
 * }} opts
 */
export async function createQueueRule(env, opts) {
  const name = typeof opts.name === "string" ? opts.name.trim().slice(0, NAME_MAX) : "";
  if (!name) return { ok: false, error: "name_required" };

  const strategy = STRATEGIES.includes(opts.strategy) ? opts.strategy : "first_responder";
  const fallbackStrategy =
    opts.fallbackStrategy === null
      ? null
      : STRATEGIES.includes(opts.fallbackStrategy)
        ? opts.fallbackStrategy
        : null;

  const id = generateId();
  const now = nowIso();
  const priority = clampPriority(opts.priority);
  const slaMinutes = clampSlaMinutes(opts.slaMinutes);
  const escalationSlaMinutes = clampSlaMinutes(opts.escalationSlaMinutes);
  const caps = serializeJsonArray(opts.requiredCapabilities);
  const description =
    typeof opts.description === "string" ? opts.description.trim().slice(0, DESC_MAX) : null;

  await env.DB.prepare(
    `INSERT INTO queue_rules
       (id, project_id, name, description, strategy, priority, sla_minutes,
        escalation_sla_minutes, required_capabilities, fallback_strategy,
        fallback_agent_user_id, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
  )
    .bind(
      id,
      opts.projectId,
      name,
      description,
      strategy,
      priority,
      slaMinutes,
      escalationSlaMinutes,
      caps,
      fallbackStrategy,
      opts.fallbackAgentUserId ?? null,
      now,
      now,
    )
    .run();

  return {
    ok: true,
    rule: mapQueueRuleRow({
      id,
      project_id: opts.projectId,
      name,
      description,
      strategy,
      priority,
      sla_minutes: slaMinutes,
      escalation_sla_minutes: escalationSlaMinutes,
      required_capabilities: caps,
      fallback_strategy: fallbackStrategy,
      fallback_agent_user_id: opts.fallbackAgentUserId ?? null,
      enabled: 1,
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
 *   strategy?: string,
 *   priority?: number,
 *   slaMinutes?: number,
 *   escalationSlaMinutes?: number,
 *   requiredCapabilities?: string[] | null,
 *   fallbackStrategy?: string | null,
 *   fallbackAgentUserId?: string | null,
 *   enabled?: boolean,
 * }} opts
 */
export async function updateQueueRule(env, opts) {
  const existing = await getQueueRule(env, { projectId: opts.projectId, ruleId: opts.ruleId });
  if (!existing) return { ok: false, error: "not_found" };

  const now = nowIso();
  const name =
    typeof opts.name === "string"
      ? opts.name.trim().slice(0, NAME_MAX)
      : existing.name;
  if (!name) return { ok: false, error: "name_required" };

  const strategy = STRATEGIES.includes(opts.strategy) ? opts.strategy : existing.strategy;
  const fallbackStrategy =
    opts.fallbackStrategy === undefined
      ? existing.fallbackStrategy
      : opts.fallbackStrategy === null
        ? null
        : STRATEGIES.includes(opts.fallbackStrategy)
          ? opts.fallbackStrategy
          : existing.fallbackStrategy;

  const priority =
    opts.priority !== undefined ? clampPriority(opts.priority) : existing.priority;
  const slaMinutes =
    opts.slaMinutes !== undefined ? clampSlaMinutes(opts.slaMinutes) : existing.slaMinutes;
  const escalationSlaMinutes =
    opts.escalationSlaMinutes !== undefined
      ? clampSlaMinutes(opts.escalationSlaMinutes)
      : existing.escalationSlaMinutes;
  const caps =
    opts.requiredCapabilities === undefined
      ? serializeJsonArray(existing.requiredCapabilities)
      : opts.requiredCapabilities === null
        ? null
        : serializeJsonArray(opts.requiredCapabilities);
  const description =
    opts.description === undefined
      ? existing.description
      : opts.description === null
        ? null
        : typeof opts.description === "string"
          ? opts.description.trim().slice(0, DESC_MAX)
          : null;
  const fallbackAgentUserId =
    opts.fallbackAgentUserId === undefined
      ? existing.fallbackAgentUserId
      : opts.fallbackAgentUserId === null
        ? null
        : typeof opts.fallbackAgentUserId === "string"
          ? opts.fallbackAgentUserId
          : null;
  const enabled = typeof opts.enabled === "boolean" ? (opts.enabled ? 1 : 0) : undefined;

  let setClauses = [
    "name = ?",
    "description = ?",
    "strategy = ?",
    "priority = ?",
    "sla_minutes = ?",
    "escalation_sla_minutes = ?",
    "required_capabilities = ?",
    "fallback_strategy = ?",
    "fallback_agent_user_id = ?",
    "updated_at = ?",
  ];
  let binds = [
    name,
    description,
    strategy,
    priority,
    slaMinutes,
    escalationSlaMinutes,
    caps,
    fallbackStrategy,
    fallbackAgentUserId,
    now,
  ];

  if (enabled !== undefined) {
    setClauses.push("enabled = ?");
    binds.push(enabled);
  }

  binds.push(opts.projectId, opts.ruleId);
  await env.DB.prepare(
    `UPDATE queue_rules SET ${setClauses.join(", ")} WHERE project_id = ? AND id = ?`,
  )
    .bind(...binds)
    .run();

  return {
    ok: true,
    rule: mapQueueRuleRow({
      ...existing,
      name,
      description,
      strategy,
      priority,
      sla_minutes: slaMinutes,
      escalation_sla_minutes: escalationSlaMinutes,
      required_capabilities: caps,
      fallback_strategy: fallbackStrategy,
      fallback_agent_user_id: fallbackAgentUserId,
      enabled: enabled !== undefined ? enabled : (existing.enabled ? 1 : 0),
      updated_at: now,
    }),
  };
}

/**
 * @param {*} env
 * @param {{ projectId: string, ruleId: string }} opts
 */
export async function deleteQueueRule(env, opts) {
  const result = await env.DB.prepare(
    `DELETE FROM queue_rules WHERE project_id = ? AND id = ?`,
  )
    .bind(opts.projectId, opts.ruleId)
    .run();
  if (!result.meta?.changes) return { ok: false, error: "not_found" };
  return { ok: true };
}

/* ── agent capacity ── */

function mapAgentCapacityRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    maxConcurrent: row.max_concurrent ?? 5,
    currentLoad: row.current_load ?? 0,
    capabilities: parseJsonArray(row.capabilities),
    isAvailable: row.is_available === 1,
    roundRobinIndex: row.round_robin_index ?? 0,
    lastAssignedAt: row.last_assigned_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * @param {*} env
 * @param {{ projectId: string, userId: string }} scope
 */
export async function getAgentCapacity(env, scope) {
  const row = await env.DB.prepare(
    `SELECT * FROM agent_capacity WHERE project_id = ? AND user_id = ?`,
  )
    .bind(scope.projectId, scope.userId)
    .first();
  return row ? mapAgentCapacityRow(row) : null;
}

/**
 * @param {*} env
 * @param {{ projectId: string }} scope
 */
export async function listAgentCapacities(env, scope) {
  const rows = await env.DB.prepare(
    `SELECT * FROM agent_capacity WHERE project_id = ? ORDER BY current_load ASC, user_id ASC`,
  )
    .bind(scope.projectId)
    .all();
  return (rows.results || []).map(mapAgentCapacityRow);
}

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   userId: string,
 *   maxConcurrent?: number,
 *   capabilities?: string[],
 *   isAvailable?: boolean,
 * }} opts
 */
export async function upsertAgentCapacity(env, opts) {
  const now = nowIso();
  const maxConcurrent = clampMaxConcurrent(opts.maxConcurrent);
  const caps = serializeJsonArray(opts.capabilities);
  const isAvailable = opts.isAvailable === false ? 0 : 1;
  const id = generateId();

  const existing = await getAgentCapacity(env, { projectId: opts.projectId, userId: opts.userId });

  if (existing) {
    let setClauses = ["max_concurrent = ?", "updated_at = ?"];
    let binds = [maxConcurrent, now];

    if (caps !== undefined) {
      setClauses.push("capabilities = ?");
      binds.push(caps);
    }
    if (opts.isAvailable !== undefined) {
      setClauses.push("is_available = ?");
      binds.push(isAvailable);
    }

    binds.push(opts.projectId, opts.userId);
    await env.DB.prepare(
      `UPDATE agent_capacity SET ${setClauses.join(", ")} WHERE project_id = ? AND user_id = ?`,
    )
      .bind(...binds)
      .run();

    return {
      ok: true,
      capacity: mapAgentCapacityRow({
        ...existing,
        max_concurrent: maxConcurrent,
        capabilities: caps !== undefined ? caps : serializeJsonArray(existing.capabilities),
        is_available: opts.isAvailable !== undefined ? isAvailable : (existing.isAvailable ? 1 : 0),
        updated_at: now,
      }),
    };
  }

  await env.DB.prepare(
    `INSERT INTO agent_capacity
       (id, project_id, user_id, max_concurrent, current_load, capabilities,
        is_available, round_robin_index, last_assigned_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?, 0, NULL, ?, ?)`,
  )
    .bind(id, opts.projectId, opts.userId, maxConcurrent, caps, isAvailable, now, now)
    .run();

  return {
    ok: true,
    capacity: mapAgentCapacityRow({
      id,
      project_id: opts.projectId,
      user_id: opts.userId,
      max_concurrent: maxConcurrent,
      current_load: 0,
      capabilities: caps,
      is_available: isAvailable,
      round_robin_index: 0,
      last_assigned_at: null,
      created_at: now,
      updated_at: now,
    }),
  };
}

/**
 * Increment/decrement current load for an agent.
 * @param {*} env
 * @param {{ projectId: string, userId: string, delta: number }} opts
 */
export async function adjustAgentLoad(env, opts) {
  const now = nowIso();
  const delta = Number(opts.delta) || 0;
  if (delta === 0) return { ok: true, skipped: true };

  const result = await env.DB.prepare(
    `UPDATE agent_capacity
     SET current_load = MAX(0, current_load + ?), updated_at = ?
     WHERE project_id = ? AND user_id = ?`,
  )
    .bind(delta, now, opts.projectId, opts.userId)
    .run();

  if (!result.meta?.changes) {
    await upsertAgentCapacity(env, {
      projectId: opts.projectId,
      userId: opts.userId,
      maxConcurrent: 5,
      capabilities: [],
      isAvailable: true,
    });
    await env.DB.prepare(
      `UPDATE agent_capacity SET current_load = MAX(0, ?), updated_at = ?
       WHERE project_id = ? AND user_id = ?`,
    )
      .bind(delta, now, opts.projectId, opts.userId)
      .run();
  }

  return { ok: true };
}

/* ── assignment history ── */

function mapAssignmentRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    roomId: row.room_id,
    taskId: row.task_id ?? null,
    agentTaskId: row.agent_task_id ?? null,
    assignedToUserId: row.assigned_to_user_id,
    assignedBy: row.assigned_by,
    strategyUsed: row.strategy_used,
    slaDueAt: row.sla_due_at ?? null,
    escalatedAt: row.escalated_at ?? null,
    escalatedToUserId: row.escalated_to_user_id ?? null,
    escalationReason: row.escalation_reason ?? null,
    resolvedAt: row.resolved_at ?? null,
    createdAt: row.created_at,
  };
}

/**
 * @param {*} env
 * @param {{ projectId: string, roomId?: string }} scope
 */
export async function listAssignments(env, scope) {
  let query = `SELECT * FROM conversation_assignments WHERE project_id = ?`;
  const binds = [scope.projectId];

  if (scope.roomId) {
    query += ` AND room_id = ?`;
    binds.push(scope.roomId);
  }

  query += ` ORDER BY created_at DESC LIMIT 100`;

  const rows = await env.DB.prepare(query).bind(...binds).all();
  return (rows.results || []).map(mapAssignmentRow);
}

/* ── routing engine ── */

/**
 * Find the best agent for a task using the specified strategy.
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   strategy: string,
 *   requiredCapabilities?: string[],
 *   fallbackStrategy?: string | null,
 *   fallbackAgentUserId?: string | null,
 * }} opts
 * @returns {Promise<{ ok: boolean, userId?: string, strategy?: string, reason?: string }>}
 */
export async function findBestAgent(env, opts) {
  const agents = await listAgentCapacities(env, { projectId: opts.projectId });
  const available = agents.filter((a) => a.isAvailable && a.currentLoad < a.maxConcurrent);

  if (!available.length) {
    if (opts.fallbackAgentUserId) {
      return { ok: true, userId: opts.fallbackAgentUserId, strategy: "fallback", reason: "no_available_agents" };
    }
    return { ok: false, error: "no_available_agents" };
  }

  let result = null;

  switch (opts.strategy) {
    case "round_robin":
      result = await findRoundRobin(env, opts.projectId, available);
      break;
    case "skill_based":
      result = findSkillBased(available, opts.requiredCapabilities || []);
      break;
    case "least_busy":
      result = findLeastBusy(available);
      break;
    case "first_responder":
    default:
      result =findFirstResponder(available);
      break;
  }

  if (!result && opts.fallbackStrategy && opts.fallbackStrategy !== opts.strategy) {
    switch (opts.fallbackStrategy) {
      case "round_robin":
        result = await findRoundRobin(env, opts.projectId, available);
        break;
      case "skill_based":
        result = findSkillBased(available, opts.requiredCapabilities || []);
        break;
      case "least_busy":
        result = findLeastBusy(available);
        break;
      case "first_responder":
      default:
        result = findFirstResponder(available);
        break;
    }
  }

  if (!result) {
    if (opts.fallbackAgentUserId) {
      return { ok: true, userId: opts.fallbackAgentUserId, strategy: "fallback", reason: "strategy_failed" };
    }
    return { ok: false, error: "no_matching_agent" };
  }

  return { ok: true, userId: result.userId, strategy: result.strategy, reason: result.reason };
}

function findFirstResponder(available) {
  if (!available.length) return null;
  const sorted = [...available].sort((a, b) => {
    const la = a.lastAssignedAt ? Date.parse(a.lastAssignedAt) : 0;
    const lb = b.lastAssignedAt ? Date.parse(b.lastAssignedAt) : 0;
    return la - lb;
  });
  return { userId: sorted[0].userId, strategy: "first_responder", reason: "earliest_last_assigned" };
}

async function findRoundRobin(env, projectId, available) {
  if (!available.length) return null;
  const sorted = [...available].sort((a, b) => (a.roundRobinIndex ?? 0) - (b.roundRobinIndex ?? 0));
  const selected = sorted[0];
  const now = nowIso();
  const nextIndex = (selected.roundRobinIndex ?? 0) + 1;
  await env.DB.prepare(
    `UPDATE agent_capacity SET round_robin_index = ?, last_assigned_at = ?, updated_at = ?
     WHERE project_id = ? AND user_id = ?`,
  )
    .bind(nextIndex, now, now, projectId, selected.userId)
    .run();
  return { userId: selected.userId, strategy: "round_robin", reason: `index_${selected.roundRobinIndex ?? 0}` };
}

function findSkillBased(available, requiredCapabilities) {
  if (!requiredCapabilities.length) return findFirstResponder(available);
  const scored = available.map((agent) => {
    const agentCaps = new Set(agent.capabilities || []);
    const matchCount = requiredCapabilities.filter((c) => agentCaps.has(c)).length;
    return { agent, matchCount };
  });
  scored.sort((a, b) => b.matchCount - a.matchCount || a.agent.currentLoad - b.agent.currentLoad);
  if (scored[0].matchCount === 0) return null;
  return { userId: scored[0].agent.userId, strategy: "skill_based", reason: `matched_${scored[0].matchCount}_skills` };
}

function findLeastBusy(available) {
  if (!available.length) return null;
  const sorted = [...available].sort((a, b) => a.currentLoad - b.currentLoad);
  return { userId: sorted[0].userId, strategy: "least_busy", reason: `load_${sorted[0].currentLoad}/${sorted[0].maxConcurrent}` };
}

/* ── auto-assignment ── */

/**
 * Find the active queue rule for a project (highest priority enabled rule).
 * @param {*} env
 * @param {{ projectId: string }} scope
 */
export async function findActiveRule(env, scope) {
  const row = await env.DB.prepare(
    `SELECT * FROM queue_rules WHERE project_id = ? AND enabled = 1
     ORDER BY priority DESC, created_at ASC LIMIT 1`,
  )
    .bind(scope.projectId)
    .first();
  return row ? mapQueueRuleRow(row) : null;
}

/**
 * Auto-assign a task to the best available agent based on the active queue rule.
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   taskId: string,
 *   roomId: string,
 * }} opts
 */
export async function autoAssignTask(env, opts) {
  const rule = await findActiveRule(env, { projectId: opts.projectId });
  if (!rule || rule.strategy === "manual") return { ok: false, skipped: true, reason: "manual_or_no_rule" };

  const result = await findBestAgent(env, {
    projectId: opts.projectId,
    strategy: rule.strategy,
    requiredCapabilities: rule.requiredCapabilities,
    fallbackStrategy: rule.fallbackStrategy,
    fallbackAgentUserId: rule.fallbackAgentUserId,
  });

  if (!result.ok) return { ok: false, skipped: true, reason: result.error };

  const now = nowIso();
  const assignmentId = generateId();
  const slaDueAt = new Date(Date.parse(now) + rule.slaMinutes * 60_000).toISOString();

  await env.DB.prepare(
    `UPDATE agent_tasks
     SET status = 'claimed', assignee_user_id = ?, claimed_at = ?, sla_due_at = ?, updated_at = ?
     WHERE id = ? AND project_id = ? AND status = 'open'`,
  )
    .bind(result.userId, now, slaDueAt, now, opts.taskId, opts.projectId)
    .run();

  await env.DB.prepare(
    `INSERT INTO conversation_assignments
       (id, project_id, room_id, task_id, agent_task_id, assigned_to_user_id,
        assigned_by, strategy_used, sla_due_at, escalated_at, escalated_to_user_id,
        escalation_reason, resolved_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'system', ?, ?, NULL, NULL, NULL, NULL, ?)`,
  )
    .bind(
      assignmentId,
      opts.projectId,
      opts.roomId,
      opts.taskId,
      opts.taskId,
      result.userId,
      result.strategy,
      slaDueAt,
      now,
    )
    .run();

  await adjustAgentLoad(env, { projectId: opts.projectId, userId: result.userId, delta: 1 });

  return {
    ok: true,
    assignmentId,
    assignedToUserId: result.userId,
    strategy: result.strategy,
    reason: result.reason,
    slaDueAt,
  };
}

/* ── SLA escalation ── */

/**
 * Find all tasks that have breached their SLA and escalate them.
 * @param {*} env
 * @param {{ projectId: string }} opts
 * @returns {Promise<{ escalated: number, details: Array }>}
 */
export async function escalateBreachedTasks(env, opts) {
  const now = nowIso();
  const rows = await env.DB.prepare(
    `SELECT t.id, t.room_id, t.assignee_user_id, t.priority, t.sla_due_at,
            r.name AS room_name
     FROM agent_tasks t
     LEFT JOIN rooms r ON r.id = t.room_id AND r.project_id = t.project_id
     WHERE t.project_id = ? AND t.status IN ('open', 'claimed')
       AND t.sla_due_at < ? AND t.sla_due_at IS NOT NULL
     ORDER BY t.sla_due_at ASC
     LIMIT 50`,
  )
    .bind(opts.projectId, now)
    .all();

  const tasks = rows.results || [];
  const details = [];

  for (const task of tasks) {
    const rule = await findActiveRule(env, { projectId: opts.projectId });
    const escalationMinutes = rule?.escalationSlaMinutes ?? 30;

    const newSlaDue = new Date(Date.parse(task.sla_due_at) + escalationMinutes * 60_000).toISOString();

    let escalatedTo = null;
    let escalationReason = "sla_breach";

    if (task.assignee_user_id) {
      await adjustAgentLoad(env, {
        projectId: opts.projectId,
        userId: task.assignee_user_id,
        delta: -1,
      });
    }

    const reassign = await findBestAgent(env, {
      projectId: opts.projectId,
      strategy: rule?.strategy ?? "least_busy",
      requiredCapabilities: rule?.requiredCapabilities,
      fallbackStrategy: rule?.fallbackStrategy,
      fallbackAgentUserId: rule?.fallbackAgentUserId,
    });

    if (reassign.ok && reassign.userId !== task.assignee_user_id) {
      escalatedTo = reassign.userId;
      escalationReason = `sla_breach_reassign_${reassign.strategy}`;

      await env.DB.prepare(
        `UPDATE agent_tasks
         SET assignee_user_id = ?, claimed_at = ?, sla_due_at = ?, updated_at = ?
         WHERE id = ? AND project_id = ?`,
      )
        .bind(reassign.userId, now, newSlaDue, now, task.id, opts.projectId)
        .run();

      await adjustAgentLoad(env, {
        projectId: opts.projectId,
        userId: reassign.userId,
        delta: 1,
      });
    } else {
      await env.DB.prepare(
        `UPDATE agent_tasks SET sla_due_at = ?, updated_at = ? WHERE id = ? AND project_id = ?`,
      )
        .bind(newSlaDue, now, task.id, opts.projectId)
        .run();
    }

    const assignmentId = generateId();
    await env.DB.prepare(
      `INSERT INTO conversation_assignments
         (id, project_id, room_id, task_id, agent_task_id, assigned_to_user_id,
          assigned_by, strategy_used, sla_due_at, escalated_at, escalated_to_user_id,
          escalation_reason, resolved_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'escalation', ?, ?, ?, ?, ?, NULL, ?)`,
    )
      .bind(
        assignmentId,
        opts.projectId,
        task.room_id,
        task.id,
        task.id,
        escalatedTo ?? task.assignee_user_id,
        rule?.strategy ?? "least_busy",
        newSlaDue,
        now,
        escalatedTo,
        escalationReason,
        now,
      )
      .run();

    details.push({
      taskId: task.id,
      roomId: task.room_id,
      roomName: task.room_name ?? task.room_id,
      previousAssignee: task.assignee_user_id,
      newAssignee: escalatedTo,
      escalationReason,
      newSlaDueAt: newSlaDue,
    });
  }

  return { escalated: details.length, details };
}

/* ── queue stats ── */

/**
 * Get comprehensive queue stats for a project.
 * @param {*} env
 * @param {{ projectId: string }} scope
 */
export async function getQueueStats(env, scope) {
  const taskRows = await env.DB.prepare(
    `SELECT status, COUNT(*) AS cnt FROM agent_tasks
     WHERE project_id = ? GROUP BY status`,
  )
    .bind(scope.projectId)
    .all();

  const agentRows = await env.DB.prepare(
    `SELECT is_available, COUNT(*) AS cnt FROM agent_capacity
     WHERE project_id = ? GROUP BY is_available`,
  )
    .bind(scope.projectId)
    .all();

  const loadRows = await env.DB.prepare(
    `SELECT SUM(current_load) AS total_load, SUM(max_concurrent) AS total_capacity
     FROM agent_capacity WHERE project_id = ? AND is_available = 1`,
  )
    .bind(scope.projectId)
    .first();

  const assignmentRows = await env.DB.prepare(
    `SELECT strategy_used, COUNT(*) AS cnt FROM conversation_assignments
     WHERE project_id = ? GROUP BY strategy_used`,
  )
    .bind(scope.projectId)
    .all();

  const slaRows = await env.DB.prepare(
    `SELECT COUNT(*) AS breached FROM agent_tasks
     WHERE project_id = ? AND status IN ('open', 'claimed')
       AND sla_due_at < ? AND sla_due_at IS NOT NULL`,
  )
    .bind(scope.projectId, nowIso())
    .first();

  const taskCounts = {};
  for (const r of taskRows.results || []) taskCounts[r.status] = r.cnt;

  const agentCounts = {};
  for (const r of agentRows.results || []) {
    agentCounts[r.is_available === 1 ? "available" : "unavailable"] = r.cnt;
  }

  const strategyCounts = {};
  for (const r of assignmentRows.results || []) strategyCounts[r.strategy_used] = r.cnt;

  return {
    tasks: {
      open: taskCounts.open ?? 0,
      claimed: taskCounts.claimed ?? 0,
      resolved: taskCounts.resolved ?? 0,
      cancelled: taskCounts.cancelled ?? 0,
      total: Object.values(taskCounts).reduce((a, b) => a + b, 0),
    },
    sla: {
      breached: slaRows?.breached ?? 0,
    },
    agents: {
      available: agentCounts.available ?? 0,
      unavailable: agentCounts.unavailable ?? 0,
      total: (agentCounts.available ?? 0) + (agentCounts.unavailable ?? 0),
    },
    load: {
      current: loadRows?.total_load ?? 0,
      capacity: loadRows?.total_capacity ?? 0,
      utilizationPercent:
        loadRows?.total_capacity > 0
          ? Math.round(((loadRows.total_load ?? 0) / loadRows.total_capacity) * 100)
          : 0,
    },
    assignments: strategyCounts,
    rules: (await listQueueRules(env, scope)).length,
  };
}
