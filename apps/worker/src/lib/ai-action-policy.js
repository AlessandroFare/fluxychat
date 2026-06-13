/**
 * P18-E: AI Action Policy Engine
 * Evaluates whether an AI action is allowed based on project policies,
 * user roles, and execution limits. Records violations for auditing.
 */

function generateId() {
  return `aip_${crypto.randomUUID().slice(0, 12)}`;
}

function nowIso() {
  return new Date().toISOString();
}

/* ── Policy CRUD ── */

function mapPolicyRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    actionType: row.action_type,
    toolName: row.tool_name ?? null,
    allowed: row.allowed === 1,
    requireApproval: row.require_approval === 1,
    maxExecutionsPerHour: row.max_executions_per_hour ?? null,
    allowedUserRoles: tryParse(row.allowed_user_roles),
    conditions: tryParse(row.conditions),
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapViolationRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    policyId: row.policy_id,
    actionId: row.action_id ?? null,
    agentId: row.agent_id ?? null,
    userId: row.user_id ?? null,
    violationType: row.violation_type,
    details: tryParse(row.details),
    createdAt: row.created_at,
  };
}

/**
 * Create a new AI action policy.
 */
export async function createPolicy(env, { projectId, name, actionType, toolName, allowed, requireApproval, maxExecutionsPerHour, allowedUserRoles, conditions }) {
  const id = generateId();
  const now = nowIso();

  await env.DB.prepare(
    `INSERT INTO ai_action_policies (id, project_id, name, action_type, tool_name, allowed, require_approval, max_executions_per_hour, allowed_user_roles, conditions, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  )
    .bind(
      id,
      projectId,
      name,
      actionType,
      toolName || null,
      allowed !== false ? 1 : 0,
      requireApproval ? 1 : 0,
      maxExecutionsPerHour ?? null,
      JSON.stringify(allowedUserRoles || ["owner", "admin"]),
      JSON.stringify(conditions || {}),
      now,
      now,
    )
    .run();

  return {
    id, projectId, name, actionType, toolName: toolName || null,
    allowed: allowed !== false, requireApproval: !!requireApproval,
    maxExecutionsPerHour: maxExecutionsPerHour ?? null,
    allowedUserRoles: allowedUserRoles || ["owner", "admin"],
    conditions: conditions || {}, enabled: true,
    createdAt: now, updatedAt: now,
  };
}

/**
 * List all AI action policies for a project.
 */
export async function listPolicies(env, { projectId }) {
  const rows = await env.DB.prepare(
    `SELECT * FROM ai_action_policies WHERE project_id = ? ORDER BY created_at DESC`
  )
    .bind(projectId)
    .all();
  return (rows.results || []).map(mapPolicyRow);
}

/**
 * Update an existing AI action policy.
 */
export async function updatePolicy(env, { projectId, policyId, name, actionType, toolName, allowed, requireApproval, maxExecutionsPerHour, allowedUserRoles, conditions, enabled }) {
  const existing = await getPolicy(env, { projectId, policyId });
  if (!existing) return null;

  const now = nowIso();
  await env.DB.prepare(
    `UPDATE ai_action_policies SET name = ?, action_type = ?, tool_name = ?, allowed = ?, require_approval = ?, max_executions_per_hour = ?, allowed_user_roles = ?, conditions = ?, enabled = ?, updated_at = ?
     WHERE id = ? AND project_id = ?`
  )
    .bind(
      name ?? existing.name,
      actionType ?? existing.actionType,
      toolName !== undefined ? toolName : existing.toolName,
      allowed !== undefined ? (allowed ? 1 : 0) : (existing.allowed ? 1 : 0),
      requireApproval !== undefined ? (requireApproval ? 1 : 0) : (existing.requireApproval ? 1 : 0),
      maxExecutionsPerHour !== undefined ? maxExecutionsPerHour : existing.maxExecutionsPerHour,
      allowedUserRoles ? JSON.stringify(allowedUserRoles) : JSON.stringify(existing.allowedUserRoles),
      conditions ? JSON.stringify(conditions) : JSON.stringify(existing.conditions),
      enabled !== undefined ? (enabled ? 1 : 0) : (existing.enabled ? 1 : 0),
      now,
      policyId,
      projectId,
    )
    .run();

  return getPolicy(env, { projectId, policyId });
}

/**
 * Delete an AI action policy.
 */
export async function deletePolicy(env, { projectId, policyId }) {
  const result = await env.DB.prepare(
    `DELETE FROM ai_action_policies WHERE id = ? AND project_id = ?`
  )
    .bind(policyId, projectId)
    .run();
  if (!result.meta?.changes) return { ok: false, error: "not_found" };
  return { ok: true };
}

/**
 * Get a single policy by ID.
 */
async function getPolicy(env, { projectId, policyId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM ai_action_policies WHERE id = ? AND project_id = ?`
  )
    .bind(policyId, projectId)
    .first();
  return row ? mapPolicyRow(row) : null;
}

/* ── Policy Evaluation Engine ── */

/**
 * Check if an AI action is allowed under the project's policies.
 * @returns {{ allowed: boolean, reason: string, requireApproval: boolean, matchedPolicy: object|null }}
 */
export async function checkPolicy(env, { projectId, actionType, toolName, userRoles, agentId }) {
  const policies = await listPolicies(env, { projectId });
  const enabledPolicies = policies.filter((p) => p.enabled);

  // Find matching policies: action_type must match, tool_name must match (if specified)
  const matched = enabledPolicies.filter((p) => {
    if (p.actionType !== actionType) return false;
    if (p.toolName && p.toolName !== toolName) return false;
    return true;
  });

  // No matching policy → default allow
  if (matched.length === 0) {
    return { allowed: true, reason: "no_policy_match", requireApproval: false, matchedPolicy: null };
  }

  // Check each matched policy (most restrictive wins)
  let finalAllowed = true;
  let finalRequireApproval = false;
  let finalReason = "allowed_by_policy";
  let matchedPolicy = null;

  for (const policy of matched) {
    // Check if user role is in allowed list
    const roles = Array.isArray(userRoles) ? userRoles : [];
    const roleAllowed = roles.some((r) => policy.allowedUserRoles.includes(r));

    if (!policy.allowed) {
      finalAllowed = false;
      finalReason = "policy_denied";
      matchedPolicy = policy;
      break;
    }

    if (!roleAllowed) {
      finalAllowed = false;
      finalReason = "role_not_permitted";
      matchedPolicy = policy;
      break;
    }

    // Check execution rate limit
    if (policy.maxExecutionsPerHour && agentId) {
      const count = await getExecutionsInLastHour(env, { projectId, actionType, agentId });
      if (count >= policy.maxExecutionsPerHour) {
        finalAllowed = false;
        finalReason = "rate_limit_exceeded";
        matchedPolicy = policy;
        break;
      }
    }

    // If any policy requires approval, the action requires approval
    if (policy.requireApproval) {
      finalRequireApproval = true;
      matchedPolicy = policy;
    }
  }

  return {
    allowed: finalAllowed,
    reason: finalReason,
    requireApproval: finalRequireApproval,
    matchedPolicy,
  };
}

/**
 * Count executions of a given action type by an agent in the last hour.
 */
async function getExecutionsInLastHour(env, { projectId, actionType, agentId }) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM ai_action_executions
     WHERE project_id = ? AND action_id LIKE ? AND created_at >= ?`
  )
    .bind(projectId, `%${actionType}%`, oneHourAgo)
    .first();
  return Number(row?.cnt || 0);
}

/* ── Violation Logging & Stats ── */

/**
 * Record a policy violation.
 */
export async function logViolation(env, { projectId, policyId, actionId, agentId, userId, violationType, details }) {
  const id = generateId();
  const now = nowIso();

  await env.DB.prepare(
    `INSERT INTO ai_policy_violations (id, project_id, policy_id, action_id, agent_id, user_id, violation_type, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, projectId, policyId, actionId || null, agentId || null, userId || null, violationType, JSON.stringify(details || {}), now)
    .run();

  return { id, projectId, policyId, violationType, createdAt: now };
}

/**
 * Get violation statistics for a project.
 */
export async function getViolationStats(env, { projectId }) {
  const byTypeRows = await env.DB.prepare(
    `SELECT violation_type, COUNT(*) AS cnt FROM ai_policy_violations
     WHERE project_id = ? GROUP BY violation_type`
  )
    .bind(projectId)
    .all();

  const totalRow = await env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM ai_policy_violations WHERE project_id = ?`
  )
    .bind(projectId)
    .first();

  const recentRows = await env.DB.prepare(
    `SELECT * FROM ai_policy_violations WHERE project_id = ? ORDER BY created_at DESC LIMIT 20`
  )
    .bind(projectId)
    .all();

  const byType = {};
  for (const r of byTypeRows.results || []) {
    byType[r.violation_type] = r.cnt;
  }

  return {
    total: Number(totalRow?.cnt || 0),
    byType,
    recent: (recentRows.results || []).map(mapViolationRow),
  };
}

function tryParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return json;
  }
}
