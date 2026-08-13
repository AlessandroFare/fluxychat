/**
 * CP-070: Policy-as-code tool approval (JSON rules, EU AI Act aligned).
 */

const DEFAULT_POLICY = {
  version: 1,
  defaultEffect: "allow",
  rules: [],
};

/**
 * @param {string} pattern
 * @param {string} toolName
 */
export function toolNameMatches(pattern, toolName) {
  if (!pattern) return false;
  if (pattern === toolName) return true;
  if (pattern.endsWith("*")) {
    return toolName.startsWith(pattern.slice(0, -1));
  }
  try {
    return new RegExp(`^${pattern}$`).test(toolName);
  } catch {
    return toolName.includes(pattern);
  }
}

/**
 * @param {*} condition
 * @param {*} input
 * @param {*} context
 */
function matchesCondition(condition, input, context) {
  if (!condition || typeof condition !== "object") return true;
  if (condition.riskTier && context?.riskTier !== condition.riskTier) return false;
  if (condition.roomType && context?.roomType !== condition.roomType) return false;
  if (condition.field && condition.equals !== undefined) {
    const val = input?.[condition.field];
    return val === condition.equals;
  }
  return true;
}

/**
 * @param {*} policyDoc
 * @param {{ toolName: string, input?: object, context?: object }} input
 */
export function evaluateToolPolicyDocument(policyDoc, input) {
  const policy = normalizePolicyDocument(policyDoc);
  const rules = [...(policy.rules || [])].sort(
    (a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0),
  );

  for (const rule of rules) {
    if (rule.enabled === false) continue;
    const patterns = Array.isArray(rule.tools) ? rule.tools : rule.tool ? [rule.tool] : [];
    const matched = patterns.some((p) => toolNameMatches(String(p), input.toolName));
    if (!matched) continue;
    if (!matchesCondition(rule.condition, input.input, input.context)) continue;

    const effect = rule.effect || "allow";
    return {
      allowed: effect !== "deny",
      requiresApproval: effect === "require_approval",
      denied: effect === "deny",
      effect,
      ruleId: rule.id || "unnamed_rule",
      reason: rule.reason || `Policy rule ${rule.id || "matched"}`,
      // NW-200: optional TTS filler while the tool runs (voice duplex)
      onHoldPhrase: typeof rule.onHoldPhrase === "string" ? rule.onHoldPhrase.trim() || null : null,
    };
  }

  const defaultEffect = policy.defaultEffect || "allow";
  return {
    allowed: defaultEffect !== "deny",
    requiresApproval: defaultEffect === "require_approval",
    denied: defaultEffect === "deny",
    effect: defaultEffect,
    ruleId: "default",
    reason: "default_policy",
    onHoldPhrase: null,
  };
}

/**
 * NW-200 — Resolve on-hold narration for a tool (matched rule phrase or default).
 * @param {*} policyDoc
 * @param {string} toolName
 * @param {{ defaultPhrase?: string }} [opts]
 */
export function resolveOnHoldPhrase(policyDoc, toolName, opts = {}) {
  const decision = evaluateToolPolicyDocument(policyDoc || DEFAULT_POLICY, {
    toolName,
    input: {},
    context: {},
  });
  if (decision.onHoldPhrase) return decision.onHoldPhrase;
  const fallback = opts.defaultPhrase ?? "One moment — I'm looking that up.";
  return fallback;
}

/**
 * @param {*} raw
 */
export function normalizePolicyDocument(raw) {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_POLICY };
  return {
    version: Number(raw.version) || 1,
    defaultEffect: raw.defaultEffect || "allow",
    rules: Array.isArray(raw.rules) ? raw.rules.slice(0, 100) : [],
  };
}

export async function getProjectToolPolicy(env, projectId) {
  const row = await env.DB.prepare(
    `SELECT policy_json, enabled FROM project_agent_tool_policies WHERE project_id = ?`,
  )
    .bind(projectId)
    .first();
  if (!row || row.enabled !== 1) return null;
  try {
    return normalizePolicyDocument(JSON.parse(row.policy_json));
  } catch {
    return null;
  }
}

export async function upsertProjectToolPolicy(env, { projectId, policy, enabled = true }) {
  const normalized = normalizePolicyDocument(policy);
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO project_agent_tool_policies (project_id, policy_json, version, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id) DO UPDATE SET
       policy_json = excluded.policy_json,
       version = excluded.version,
       enabled = excluded.enabled,
       updated_at = excluded.updated_at`,
  )
    .bind(projectId, JSON.stringify(normalized), normalized.version, enabled ? 1 : 0, now, now)
    .run();
  return { ok: true, policy: normalized };
}

export async function evaluateProjectToolPolicy(env, input) {
  const policy = await getProjectToolPolicy(env, input.projectId);
  if (!policy) {
    return {
      allowed: true,
      requiresApproval: false,
      denied: false,
      effect: "allow",
      ruleId: "none",
      reason: "no_policy",
      onHoldPhrase: null,
    };
  }
  const decision = evaluateToolPolicyDocument(policy, input);
  await recordToolPolicyAudit(env, {
    projectId: input.projectId,
    toolName: input.toolName,
    effect: decision.effect,
    ruleId: decision.ruleId,
    runId: input.context?.runId,
    roomId: input.context?.roomId,
    userId: input.context?.userId,
    input: input.input,
  });
  return decision;
}

export async function recordToolPolicyAudit(env, {
  projectId,
  toolName,
  effect,
  ruleId,
  runId,
  roomId,
  userId,
  input,
}) {
  if (!env?.DB) return;
  const id = `atpa_${crypto.randomUUID().slice(0, 12)}`;
  await env.DB.prepare(
    `INSERT INTO agent_tool_policy_audit
     (id, project_id, tool_name, effect, rule_id, run_id, room_id, user_id, input_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      projectId,
      toolName,
      effect,
      ruleId || null,
      runId || null,
      roomId || null,
      userId || null,
      input ? JSON.stringify(input).slice(0, 8000) : null,
      new Date().toISOString(),
    )
    .run()
    .catch(() => {});
}

/**
 * Merge JSON policy decisions into an existing HITL approval gate.
 * @param {{ needsApproval: Function } | null} baseGate
 * @param {*} env
 * @param {string} projectId
 */
export function createPolicyAwareApprovalGate(baseGate, env, projectId) {
  return {
    async needsApproval(toolName, input, context) {
      const decision = await evaluateProjectToolPolicy(env, {
        projectId,
        toolName,
        input,
        context: { ...context, runId: context?.runId },
      });
      if (decision.denied) {
        const err = new Error(decision.reason || "tool_denied_by_policy");
        err.code = "policy_denied";
        err.policyDecision = decision;
        throw err;
      }
      if (decision.requiresApproval) return true;
      if (baseGate?.needsApproval) {
        return baseGate.needsApproval(toolName, input, context);
      }
      return false;
    },
    shouldApprove: baseGate?.shouldApprove,
  };
}
