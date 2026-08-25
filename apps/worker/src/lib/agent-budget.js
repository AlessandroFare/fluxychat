/**
 * F2 — Agent budget circuit breaker (per-room, hard enforcement).
 *
 * WHAT THIS GUARANTEES
 * --------------------
 * A room owner can set a monthly token cap for AI agents in that room. When the
 * cap is reached, agent invocations are REJECTED before any LLM call is made:
 * a runaway agent physically cannot exceed the budget, because the gate sits at
 * the single choke point every invocation passes through
 * (`invokeMentionedAgents` -> `checkRoomAgentBudget` -> block or proceed).
 *
 * SOURCE OF TRUTH
 * ---------------
 * Consumption is computed from `agent_runs` (input_tokens + output_tokens),
 * which every completed run already writes. No second ledger to drift.
 *
 * Concurrent invokes: `tryReserveRoomAgentTokens` holds the remaining budget
 * atomically (used + inflight + hold <= cap) so two mentions cannot both pass
 * a check-then-spend window. The hold is released in a finally block; actual
 * spend still lives in `agent_runs`.
 */

export const BUDGET_MONTH_KEY_RE = /^\d{4}-\d{2}$/;

/** Current billing window key, e.g. "2026-08". */
export function currentMonthKey(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function isValidMonthKey(value) {
  return typeof value === "string" && BUDGET_MONTH_KEY_RE.test(value);
}

/**
 * Pure decision function. Kept separate from IO so the policy is unit-testable.
 *
 * @param {{ usedTokens: number, monthlyTokenBudget: number | null | undefined, enabled: boolean }} input
 * @returns {{ allowed: boolean, reason?: string, usedTokens: number, budget: number | null, remaining: number | null }}
 */
export function evaluateBudget({ usedTokens, monthlyTokenBudget, enabled }) {
  const used = Number.isFinite(Number(usedTokens)) ? Math.max(0, Number(usedTokens)) : 0;

  // No budget configured or gate disabled => unlimited. Default-off keeps
  // existing rooms working unchanged.
  if (!enabled || !Number.isFinite(Number(monthlyTokenBudget)) || Number(monthlyTokenBudget) <= 0) {
    return { allowed: true, usedTokens: used, budget: null, remaining: null };
  }

  const budget = Math.floor(Number(monthlyTokenBudget));
  const remaining = Math.max(0, budget - used);
  if (used >= budget) {
    return { allowed: false, reason: "room_agent_budget_exhausted", usedTokens: used, budget, remaining: 0 };
  }
  return { allowed: true, usedTokens: used, budget, remaining };
}

/**
 * Read the budget configuration row for a room (if any).
 * @param {*} env
 */
export async function getRoomAgentBudget(env, projectId, roomId) {
  if (!env?.DB) return null;
  try {
    return await env.DB.prepare(
      `SELECT project_id, room_id, monthly_token_budget, enabled, updated_at, inflight_tokens
       FROM room_agent_budgets WHERE project_id = ? AND room_id = ?`,
    )
      .bind(projectId, roomId)
      .first();
  } catch {
    // Table may not exist yet on un-migrated envs: treat as unconfigured.
    return null;
  }
}

/**
 * Tokens consumed by ALL agents in this room during the billing month.
 * Single source of truth: agent_runs.
 */
export async function getRoomMonthlyTokenUsage(env, projectId, roomId, monthKey = currentMonthKey()) {
  if (!env?.DB) return 0;
  try {
    const row = await env.DB.prepare(
      `SELECT COALESCE(SUM(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)), 0) AS used
       FROM agent_runs WHERE project_id = ? AND room_id = ? AND created_at LIKE ?`,
    )
      .bind(projectId, roomId, `${monthKey}-%`)
      .first();
    return Number(row?.used ?? 0) || 0;
  } catch {
    return 0;
  }
}

/**
 * THE GATE. Call before spending a single token in a room.
 * @param {*} env
 * @returns {Promise<ReturnType<typeof evaluateBudget> & { monthKey: string, inflightTokens: number }>}
 */
export async function checkRoomAgentBudget(env, projectId, roomId, now = new Date()) {
  const monthKey = currentMonthKey(now);
  const config = await getRoomAgentBudget(env, projectId, roomId);
  const usedTokens = await getRoomMonthlyTokenUsage(env, projectId, roomId, monthKey);
  const inflight = Math.max(0, Number(config?.inflight_tokens) || 0);
  const decision = evaluateBudget({
    usedTokens: usedTokens + inflight,
    monthlyTokenBudget: config?.monthly_token_budget,
    enabled: Boolean(config?.enabled),
  });
  return { ...decision, monthKey, inflightTokens: inflight };
}

/**
 * Atomically hold tokens against the monthly cap. `meta.changes === 0` means
 * another in-flight invoke already reserved the remainder.
 *
 * @returns {Promise<{ ok: boolean, held: number, degraded?: boolean }>}
 */
export async function tryReserveRoomAgentTokens(env, projectId, roomId, holdTokens, monthKey = currentMonthKey()) {
  const hold = Math.max(1, Math.floor(Number(holdTokens) || 0));
  if (!env?.DB) return { ok: true, held: 0, degraded: true };
  try {
    const result = await env.DB.prepare(
      `UPDATE room_agent_budgets
       SET inflight_tokens = COALESCE(inflight_tokens, 0) + ?
       WHERE project_id = ? AND room_id = ? AND enabled = 1
         AND monthly_token_budget IS NOT NULL AND monthly_token_budget > 0
         AND (
           COALESCE(inflight_tokens, 0) + ?
           + COALESCE((
               SELECT SUM(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0))
               FROM agent_runs
               WHERE project_id = room_agent_budgets.project_id
                 AND room_id = room_agent_budgets.room_id
                 AND created_at LIKE ?
             ), 0)
         ) <= monthly_token_budget`,
    )
      .bind(hold, projectId, roomId, hold, `${monthKey}-%`)
      .run();
    const changes = Number(result?.meta?.changes ?? 0);
    return { ok: changes > 0, held: changes > 0 ? hold : 0 };
  } catch {
    // Pre-0218 D1: no inflight column. Degrade to check-only rather than crash.
    return { ok: true, held: 0, degraded: true };
  }
}

export async function releaseRoomAgentTokens(env, projectId, roomId, holdTokens) {
  const hold = Math.max(0, Math.floor(Number(holdTokens) || 0));
  if (!hold || !env?.DB) return;
  try {
    await env.DB.prepare(
      `UPDATE room_agent_budgets
       SET inflight_tokens = MAX(0, COALESCE(inflight_tokens, 0) - ?)
       WHERE project_id = ? AND room_id = ?`,
    )
      .bind(hold, projectId, roomId)
      .run();
  } catch {
    /* pre-0218 or missing row */
  }
}

/**
 * Upsert the budget config. `monthlyTokenBudget <= 0` or null clears the cap.
 * @param {*} env
 */
export async function setRoomAgentBudget(env, projectId, roomId, { monthlyTokenBudget, enabled }) {
  const budgetValue =
    monthlyTokenBudget == null || Number(monthlyTokenBudget) <= 0
      ? null
      : Math.max(0, Math.floor(Number(monthlyTokenBudget)));
  const enabledValue = enabled === false ? 0 : 1;

  await env.DB.prepare(
    `INSERT INTO room_agent_budgets (project_id, room_id, monthly_token_budget, enabled, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(project_id, room_id) DO UPDATE SET
       monthly_token_budget = excluded.monthly_token_budget,
       enabled = excluded.enabled,
       updated_at = excluded.updated_at`,
  )
    .bind(projectId, roomId, budgetValue, enabledValue, new Date().toISOString())
    .run();

  return {
    projectId,
    roomId,
    monthlyTokenBudget: budgetValue,
    enabled: Boolean(enabledValue),
  };
}
