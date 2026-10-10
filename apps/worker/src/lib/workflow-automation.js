import { fanoutServerEvent } from "./message-realtime-fanout.js";
import { timingSafeEqual } from "./crypto-timing.js";

function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// --- Workflow Definitions ---

export async function createWorkflow(env, { projectId, name, description, triggerType, triggerConfig, actions, conditions, errorHandling, maxRetries, timeoutSeconds, createdBy }) {
  const id = `wf_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO workflow_definitions (id, project_id, name, description, status, trigger_type, trigger_config, actions, conditions, error_handling, max_retries, timeout_seconds, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, name, description || null, triggerType, triggerConfig ? JSON.stringify(triggerConfig) : null, JSON.stringify(actions), conditions ? JSON.stringify(conditions) : null, errorHandling || "stop", maxRetries || 3, timeoutSeconds || 30, createdBy || null, now, now).run();
  return { id };
}

export async function updateWorkflow(env, { workflowId, name, description, status, triggerConfig, actions, conditions, errorHandling }) {
  const now = new Date().toISOString();
  const sets = ["updated_at = ?"];
  const params = [now];
  if (name) { sets.push("name = ?"); params.push(name); }
  if (description !== undefined) { sets.push("description = ?"); params.push(description); }
  if (status) { sets.push("status = ?"); params.push(status); }
  if (triggerConfig) { sets.push("trigger_config = ?"); params.push(JSON.stringify(triggerConfig)); }
  if (actions) { sets.push("actions = ?"); params.push(JSON.stringify(actions)); }
  if (conditions) { sets.push("conditions = ?"); params.push(JSON.stringify(conditions)); }
  if (errorHandling) { sets.push("error_handling = ?"); params.push(errorHandling); }
  params.push(workflowId);
  await env.DB.prepare(`UPDATE workflow_definitions SET ${sets.join(", ")} WHERE id = ?`).bind(...params).run();
  return { updated: true };
}

export async function getWorkflow(env, { workflowId, projectId }) {
  const row = await env.DB.prepare("SELECT * FROM workflow_definitions WHERE id = ?").bind(workflowId).first();
  if (!row) return null;
  const mapped = mapWorkflowRow(row);
  if (projectId && mapped.projectId !== projectId) return null;
  return mapped;
}

export async function deleteAutomationWorkflow(env, { workflowId, projectId }) {
  const wf = await getWorkflow(env, { workflowId, projectId });
  if (!wf) return { error: "not_found" };
  await env.DB.prepare("DELETE FROM workflow_definitions WHERE id = ?").bind(workflowId).run();
  return { ok: true, id: workflowId };
}

export async function archiveWorkflow(env, { workflowId, projectId }) {
  const wf = await getWorkflow(env, { workflowId, projectId });
  if (!wf) return { error: "not_found" };
  await updateWorkflow(env, { workflowId, status: "archived" });
  return { ok: true, status: "archived" };
}

export async function unarchiveWorkflow(env, { workflowId, projectId }) {
  const wf = await getWorkflow(env, { workflowId, projectId });
  if (!wf) return { error: "not_found" };
  await updateWorkflow(env, { workflowId, status: "draft" });
  return { ok: true, status: "draft" };
}

export async function findWebhookPathConflict(env, { workflowId, triggerConfig }) {
  const path = String(triggerConfig?.path || "").trim();
  if (!WEBHOOK_HOOK_PATH_RE.test(path)) return null;
  const method = String(triggerConfig?.method || triggerConfig?.httpMethod || "GET").toUpperCase();
  const active = await listWorkflows(env, { status: "active", triggerType: "webhook", limit: 200 });
  return active.find((wf) => wf.id !== workflowId && matchWebhookTrigger(wf, path, method)) || null;
}

export async function listWorkflows(env, { projectId, status, triggerType, limit = 25 }) {
  const params = [];
  let sql = "SELECT * FROM workflow_definitions WHERE 1=1";
  if (projectId) { sql += " AND project_id = ?"; params.push(projectId); }
  if (status) { sql += " AND status = ?"; params.push(status); }
  if (triggerType) { sql += " AND trigger_type = ?"; params.push(triggerType); }
  sql += " ORDER BY updated_at DESC LIMIT ?";
  params.push(limit);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapWorkflowRow);
}

// --- Executions ---

export function evaluateWorkflowConditions(conditions, context = {}) {
  if (!conditions) return true;
  const list = Array.isArray(conditions)
    ? conditions
    : Array.isArray(conditions.all)
      ? conditions.all
      : Array.isArray(conditions.rules)
        ? conditions.rules
        : [];
  if (!list.length) return true;
  return list.every((c) => {
    const val = context[c.field];
    switch (c.operator) {
      case "eq": return val === c.value;
      case "neq": return val !== c.value;
      case "contains": return String(val ?? "").includes(String(c.value));
      case "gt": return Number(val) > Number(c.value);
      case "lt": return Number(val) < Number(c.value);
      default: return val === c.value;
    }
  });
}

export const WEBHOOK_HOOK_PATH_RE = /^[a-zA-Z0-9_-]{8,128}$/;
const WEBHOOK_METHODS = new Set(["DELETE", "GET", "HEAD", "PATCH", "POST", "PUT"]);
const MAX_WEBHOOK_BODY_BYTES = 65_536;

export function splitWaitActions(actions) {
  const list = Array.isArray(actions) ? actions : [];
  const idx = list.findIndex((a) => String(a.type || a.action || "") === "wait_webhook");
  if (idx < 0) return { before: list, wait: null, after: [] };
  return { before: list.slice(0, idx), wait: list[idx], after: list.slice(idx + 1) };
}

function webhookMethod(config) {
  const m = String(config?.method || config?.httpMethod || "GET").toUpperCase();
  return WEBHOOK_METHODS.has(m) ? m : "GET";
}

export function matchWebhookTrigger(workflow, hookPath, method) {
  if (!workflow || workflow.status !== "active") return false;
  const type = String(workflow.triggerType || "");
  if (type !== "webhook" && type !== "webhook_received") return false;
  const cfg = workflow.triggerConfig && typeof workflow.triggerConfig === "object" ? workflow.triggerConfig : {};
  const path = String(cfg.path || "").trim();
  if (!WEBHOOK_HOOK_PATH_RE.test(path) || path !== hookPath) return false;
  return webhookMethod(cfg) === String(method || "GET").toUpperCase();
}

export async function ingestWorkflowWebhook(env, { hookPath, method, query, headers, body }) {
  const path = String(hookPath || "").trim();
  const m = String(method || "GET").toUpperCase();
  if (!WEBHOOK_HOOK_PATH_RE.test(path) || !WEBHOOK_METHODS.has(m)) {
    return { ok: false, error: "not_found", status: 404 };
  }
  const bodyJson = body == null ? null : typeof body === "string" ? body : JSON.stringify(body);
  if (bodyJson && bodyJson.length > MAX_WEBHOOK_BODY_BYTES) {
    return { ok: false, error: "payload_too_large", status: 413 };
  }
  const workflows = await listWorkflows(env, { projectId: undefined, status: "active", triggerType: "webhook", limit: 200 });
  const extra = await listWorkflows(env, { projectId: undefined, status: "active", triggerType: "webhook_received", limit: 200 });
  const candidates = [...workflows, ...extra].filter((wf) => matchWebhookTrigger(wf, path, m));
  if (!candidates.length) return { ok: false, error: "not_found", status: 404 };

  const headerBag = headers && typeof headers === "object" ? headers : {};
  for (const wf of candidates) {
    const cfg = wf.triggerConfig || {};
    const name = cfg.headerName || cfg.authHeader;
    const expected = cfg.headerValue || cfg.authValue;
    if (name && expected != null) {
      const got = headerBag[String(name).toLowerCase()] ?? headerBag[String(name)];
      const ok = await timingSafeEqual(String(expected), String(got ?? ""));
      if (!ok) return { ok: false, error: "unauthorized", status: 401 };
    }
  }

  const triggerData = {
    method: m,
    path,
    query: query && typeof query === "object" ? query : {},
    body: body ?? null,
  };
  const runs = [];
  for (const wf of candidates) {
    const result = await startExecution(env, {
      workflowId: wf.id,
      projectId: wf.projectId,
      triggerData,
      context: { source: "webhook" },
    });
    runs.push({ workflowId: wf.id, ...result });
  }
  return { ok: true, runs };
}

export async function getExecution(env, { executionId, projectId }) {
  const row = await env.DB.prepare("SELECT * FROM workflow_executions WHERE id = ?").bind(executionId).first();
  if (!row) return null;
  if (projectId && row.project_id !== projectId) return null;
  return mapExecutionRow(row);
}

export async function retryExecution(env, { executionId, projectId }) {
  const exec = await getExecution(env, { executionId, projectId });
  if (!exec) return { error: "not_found" };
  return startExecution(env, {
    workflowId: exec.workflowId,
    projectId: exec.projectId,
    triggerData: exec.triggerData,
    context: { ...(exec.context || {}), retryOf: executionId },
  });
}

export async function activateWorkflow(env, { workflowId, projectId }) {
  const wf = await getWorkflow(env, { workflowId, projectId });
  if (!wf) return { error: "not_found" };
  const conflict = await findWebhookPathConflict(env, { workflowId, triggerConfig: wf.triggerConfig });
  if (conflict) return { error: "webhook_path_conflict", conflictId: conflict.id };
  await updateWorkflow(env, { workflowId, status: "active" });
  return { ok: true, status: "active" };
}

export async function deactivateWorkflow(env, { workflowId, projectId }) {
  const wf = await getWorkflow(env, { workflowId, projectId });
  if (!wf) return { error: "not_found" };
  await updateWorkflow(env, { workflowId, status: "draft" });
  return { ok: true, status: "draft" };
}

export async function stopExecution(env, { executionId, projectId }) {
  const exec = await getExecution(env, { executionId, projectId });
  if (!exec) return { error: "not_found" };
  if (exec.status !== "running" && exec.status !== "waiting") {
    return { error: "not_stoppable", status: exec.status };
  }
  await completeExecution(env, { executionId, status: "cancelled" });
  return { ok: true, id: executionId, status: "cancelled" };
}

export async function deleteExecution(env, { executionId, projectId }) {
  const exec = await getExecution(env, { executionId, projectId });
  if (!exec) return { error: "not_found" };
  await env.DB.prepare("DELETE FROM workflow_executions WHERE id = ?").bind(executionId).run();
  return { ok: true, id: executionId };
}

export async function resumeWaitingExecution(env, { executionId, token }) {
  const exec = await getExecution(env, { executionId });
  if (!exec || exec.status !== "waiting") return { ok: false, error: "not_found", status: 404 };
  const expected = exec.context?.waitToken;
  if (!expected || !(await timingSafeEqual(String(expected), String(token || "")))) {
    return { ok: false, error: "unauthorized", status: 401 };
  }
  const remaining = Array.isArray(exec.context?.remainingActions) ? exec.context.remainingActions : [];
  await runWorkflowActions(env, {
    projectId: exec.projectId,
    roomId: exec.context?.roomId,
    actions: remaining,
    context: exec.triggerData || {},
  });
  await completeExecution(env, { executionId, status: "completed" });
  return { ok: true, id: executionId };
}

export async function runDueWorkflowSchedules(env, { nowMs = Date.now(), limit = 25 } = {}) {
  const nowIso = new Date(nowMs).toISOString();
  const rows = await env.DB.prepare(
    `SELECT * FROM workflow_schedules WHERE enabled = 1 AND next_run_at IS NOT NULL AND next_run_at <= ? ORDER BY next_run_at ASC LIMIT ?`,
  )
    .bind(nowIso, limit)
    .all();
  const fired = [];
  for (const row of rows.results || []) {
    const result = await startExecution(env, {
      workflowId: row.workflow_id,
      projectId: row.project_id,
      triggerData: { source: "schedule", scheduleId: row.id },
      context: { source: "schedule" },
    });
    const interval = Number(row.interval_ms) > 0 ? Number(row.interval_ms) : 3_600_000;
    const next = new Date(nowMs + interval).toISOString();
    await env.DB.prepare(
      "UPDATE workflow_schedules SET last_run_at = ?, next_run_at = ? WHERE id = ?",
    )
      .bind(nowIso, next, row.id)
      .run();
    fired.push({ scheduleId: row.id, ...result });
  }
  return { ok: true, fired };
}

export async function runWorkflowActions(env, { projectId, roomId, actions, context = {} }) {
  const results = [];
  for (const action of actions || []) {
    const type = String(action.type || action.action || "");
    const params = action.params && typeof action.params === "object" ? action.params : action;
    if (type === "send_webhook" || type === "call_webhook") {
      results.push({ type, success: true, result: "recorded", note: "webhook_not_fetched" });
      continue;
    }
    await fanoutServerEvent(env, {
      projectId,
      roomId: roomId || context.roomId || "workflows",
      name: `workflow.${type || "action"}`,
      userId: context.userId || "workflow",
      data: { type, params },
    }).catch(() => {});
    results.push({ type, success: true, result: "fanout" });
  }
  return results;
}

export async function startExecution(env, { workflowId, projectId, triggerData, context }) {
  const workflow = await getWorkflow(env, { workflowId });
  if (!workflow) return { error: "not_found" };
  if (workflow.projectId && workflow.projectId !== projectId) return { error: "not_found" };
  if (workflow.status === "archived") return { error: "archived" };

  const bag = { ...(context || {}), ...(triggerData || {}) };
  const matched = evaluateWorkflowConditions(workflow.conditions, bag);
  const id = `wfe_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO workflow_executions (id, workflow_id, project_id, status, trigger_data, context, started_at, created_at)
     VALUES (?, ?, ?, 'running', ?, ?, ?, ?)`
  ).bind(id, workflowId, projectId, triggerData ? JSON.stringify(triggerData) : null, context ? JSON.stringify(context) : null, now, now).run();

  await env.DB.prepare(
    "UPDATE workflow_definitions SET run_count = run_count + 1, last_run_at = ?, updated_at = ? WHERE id = ?"
  ).bind(now, now, workflowId).run();

  if (!matched) {
    await completeExecution(env, { executionId: id, status: "skipped" });
    return { id, skipped: true, matchedConditions: false };
  }

  const { before, wait, after } = splitWaitActions(workflow.actions);
  const actions = await runWorkflowActions(env, {
    projectId,
    roomId: bag.roomId,
    actions: before,
    context: bag,
  });
  if (wait) {
    const waitToken = `wt_${generateId().slice(0, 16)}`;
    const waitingContext = {
      ...(context && typeof context === "object" ? context : {}),
      remainingActions: after,
      waitToken,
      roomId: bag.roomId || null,
    };
    await env.DB.prepare(
      "UPDATE workflow_executions SET status = ?, context = ? WHERE id = ?",
    )
      .bind("waiting", JSON.stringify(waitingContext), id)
      .run();
    return { id, matchedConditions: true, waiting: true, waitToken, actions };
  }
  await completeExecution(env, { executionId: id, status: "completed" });
  return { id, matchedConditions: true, actions };
}

const STATE_SCOPES = new Set(["conversation", "user", "bot", "workflow"]);
const MAX_STATE_KEY = 128;
const MAX_STATE_VALUE_BYTES = 16_384;

function parseStateScope(input) {
  const scope = String(input || "").trim();
  if (!STATE_SCOPES.has(scope)) return null;
  return scope;
}

export async function getWorkflowState(env, { projectId, scope, scopeId, key }) {
  const sc = parseStateScope(scope);
  const sid = String(scopeId || "").trim();
  const k = String(key || "").trim();
  if (!sc || !sid || !k) return { ok: false, error: "scope_scopeId_key_required" };
  const row = await env.DB.prepare(
    `SELECT value_json, expires_at FROM workflow_states
     WHERE project_id = ? AND scope = ? AND scope_id = ? AND key = ? LIMIT 1`,
  )
    .bind(projectId, sc, sid, k)
    .first();
  if (!row) return { ok: true, value: null };
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    await env.DB.prepare(
      "DELETE FROM workflow_states WHERE project_id = ? AND scope = ? AND scope_id = ? AND key = ?",
    )
      .bind(projectId, sc, sid, k)
      .run();
    return { ok: true, value: null, expired: true };
  }
  try {
    return { ok: true, value: JSON.parse(row.value_json) };
  } catch {
    return { ok: true, value: row.value_json };
  }
}

export async function setWorkflowState(env, { projectId, scope, scopeId, key, value, ttlSeconds }) {
  const sc = parseStateScope(scope);
  const sid = String(scopeId || "").trim();
  const k = String(key || "").trim();
  if (!sc || !sid || !k) return { ok: false, error: "scope_scopeId_key_required" };
  if (k.length > MAX_STATE_KEY) return { ok: false, error: "key_too_long" };
  const json = JSON.stringify(value ?? null);
  if (json.length > MAX_STATE_VALUE_BYTES) return { ok: false, error: "value_too_large" };
  const ttl = Number(ttlSeconds);
  const expiresAt = Number.isFinite(ttl) && ttl > 0
    ? new Date(Date.now() + ttl * 1000).toISOString()
    : null;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO workflow_states (project_id, scope, scope_id, key, value_json, expires_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, scope, scope_id, key) DO UPDATE SET
       value_json = excluded.value_json,
       expires_at = excluded.expires_at,
       updated_at = excluded.updated_at`,
  )
    .bind(projectId, sc, sid, k, json, expiresAt, now)
    .run();
  return { ok: true, scope: sc, scopeId: sid, key: k, expiresAt };
}

export async function deleteWorkflowState(env, { projectId, scope, scopeId, key }) {
  const sc = parseStateScope(scope);
  const sid = String(scopeId || "").trim();
  const k = String(key || "").trim();
  if (!sc || !sid || !k) return { ok: false, error: "scope_scopeId_key_required" };
  await env.DB.prepare(
    "DELETE FROM workflow_states WHERE project_id = ? AND scope = ? AND scope_id = ? AND key = ?",
  )
    .bind(projectId, sc, sid, k)
    .run();
  return { ok: true };
}

export async function dispatchWorkflowEvent(env, { projectId, triggerType, triggerData, context }) {
  const type = String(triggerType || "").trim();
  if (!type) return { ok: false, error: "trigger_type_required" };
  const workflows = await listWorkflows(env, { projectId, status: "active", triggerType: type, limit: 50 });
  const runs = [];
  for (const wf of workflows) {
    const result = await startExecution(env, {
      workflowId: wf.id,
      projectId,
      triggerData,
      context,
    });
    runs.push({ workflowId: wf.id, ...result });
  }
  return { ok: true, triggerType: type, runs };
}

export async function completeExecution(env, { executionId, status, error }) {
  const now = new Date().toISOString();
  const exec = await env.DB.prepare("SELECT started_at FROM workflow_executions WHERE id = ?").bind(executionId).first();
  const durationMs = exec ? Date.now() - new Date(exec.started_at).getTime() : 0;

  await env.DB.prepare(
    "UPDATE workflow_executions SET status = ?, completed_at = ?, duration_ms = ?, error = ? WHERE id = ?"
  ).bind(status, now, durationMs, error || null, executionId).run();

  return { completed: true, durationMs };
}

export async function listExecutions(env, { projectId, workflowId, status, limit = 25 }) {
  let sql = "SELECT * FROM workflow_executions WHERE project_id = ?";
  const params = [projectId];
  if (workflowId) { sql += " AND workflow_id = ?"; params.push(workflowId); }
  if (status) { sql += " AND status = ?"; params.push(status); }
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapExecutionRow);
}

// --- Execution Steps ---

export async function startStep(env, { executionId, workflowId, stepIndex, stepType, stepConfig, input }) {
  const id = `wfes_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO workflow_execution_steps (id, execution_id, workflow_id, step_index, step_type, step_config, input, status, started_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'running', ?, ?)`
  ).bind(id, executionId, workflowId, stepIndex, stepType, stepConfig ? JSON.stringify(stepConfig) : null, input ? JSON.stringify(input) : null, now, now).run();
  return { id };
}

export async function completeStep(env, { stepId, status, output, error }) {
  const now = new Date().toISOString();
  const step = await env.DB.prepare("SELECT started_at FROM workflow_execution_steps WHERE id = ?").bind(stepId).first();
  const durationMs = step ? Date.now() - new Date(step.started_at).getTime() : 0;

  await env.DB.prepare(
    "UPDATE workflow_execution_steps SET status = ?, output = ?, error = ?, completed_at = ?, duration_ms = ? WHERE id = ?"
  ).bind(status, output ? JSON.stringify(output) : null, error || null, now, durationMs, stepId).run();

  return { completed: true, durationMs };
}

export async function listExecutionSteps(env, { executionId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM workflow_execution_steps WHERE execution_id = ? ORDER BY step_index ASC"
  ).bind(executionId).all();
  return (rows.results || []).map(mapStepRow);
}

// --- Templates ---

export async function createTemplate(env, { projectId, name, description, category, triggerType, actions, conditions, isOfficial }) {
  const id = `wft_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO workflow_templates (id, project_id, name, description, category, trigger_type, actions, conditions, is_official, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId || null, name, description || null, category, triggerType, JSON.stringify(actions), conditions ? JSON.stringify(conditions) : null, isOfficial ? 1 : 0, now).run();
  return { id };
}

export async function listTemplates(env, { projectId, category, officialOnly }) {
  let sql = "SELECT * FROM workflow_templates WHERE (project_id = ? OR project_id IS NULL)";
  const params = [projectId];
  if (category) { sql += " AND category = ?"; params.push(category); }
  if (officialOnly) { sql += " AND is_official = 1"; }
  sql += " ORDER BY use_count DESC";
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapTemplateRow);
}

export async function useTemplate(env, { templateId }) {
  const now = new Date().toISOString();
  await env.DB.prepare("UPDATE workflow_templates SET use_count = use_count + 1 WHERE id = ?").bind(templateId).run();
  return { used: true };
}

// --- Schedules ---

export async function createSchedule(env, { workflowId, projectId, scheduleType, intervalMs, cronExpression, nextRunAt }) {
  const id = `wfs_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO workflow_schedules (id, workflow_id, project_id, schedule_type, interval_ms, cron_expression, next_run_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, workflowId, projectId, scheduleType, intervalMs || null, cronExpression || null, nextRunAt || null, now).run();
  return { id };
}

export async function updateSchedule(env, { scheduleId, enabled, nextRunAt }) {
  const sets = [];
  const params = [];
  if (enabled !== undefined) { sets.push("enabled = ?"); params.push(enabled ? 1 : 0); }
  if (nextRunAt) { sets.push("next_run_at = ?"); params.push(nextRunAt); }
  if (sets.length === 0) return { updated: 0 };
  params.push(scheduleId);
  await env.DB.prepare(`UPDATE workflow_schedules SET ${sets.join(", ")} WHERE id = ?`).bind(...params).run();
  return { updated: true };
}

export async function listSchedules(env, { projectId, enabled }) {
  let sql = "SELECT * FROM workflow_schedules WHERE project_id = ?";
  const params = [projectId];
  if (enabled !== undefined) { sql += " AND enabled = ?"; params.push(enabled ? 1 : 0); }
  sql += " ORDER BY next_run_at ASC";
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapScheduleRow);
}

// --- Stats ---

export async function getWorkflowStats(env, { projectId }) {
  const workflows = await env.DB.prepare(
    "SELECT status, COUNT(*) as count FROM workflow_definitions WHERE project_id = ? GROUP BY status"
  ).bind(projectId).all();

  const executions = await env.DB.prepare(
    "SELECT status, COUNT(*) as count FROM workflow_executions WHERE project_id = ? GROUP BY status"
  ).bind(projectId).all();

  const avgDuration = await env.DB.prepare(
    "SELECT AVG(duration_ms) as avg_dur FROM workflow_executions WHERE project_id = ? AND status = 'completed'"
  ).bind(projectId).first();

  return {
    workflows: (workflows.results || []).map((w) => ({ status: w.status, count: w.count })),
    executions: (executions.results || []).map((e) => ({ status: e.status, count: e.count })),
    avgDurationMs: avgDuration?.avg_dur || 0,
  };
}

// --- Helpers ---

function mapWorkflowRow(row) {
  return {
    id: row.id, projectId: row.project_id, name: row.name, description: row.description,
    status: row.status, triggerType: row.trigger_type,
    triggerConfig: row.trigger_config ? JSON.parse(row.trigger_config) : null,
    actions: JSON.parse(row.actions),
    conditions: row.conditions ? JSON.parse(row.conditions) : null,
    errorHandling: row.error_handling, maxRetries: row.max_retries,
    timeoutSeconds: row.timeout_seconds, runCount: row.run_count,
    lastRunAt: row.last_run_at, lastError: row.last_error,
    createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapExecutionRow(row) {
  return {
    id: row.id, workflowId: row.workflow_id, projectId: row.project_id,
    status: row.status,
    triggerData: row.trigger_data ? JSON.parse(row.trigger_data) : null,
    context: row.context ? JSON.parse(row.context) : null,
    startedAt: row.started_at, completedAt: row.completed_at,
    durationMs: row.duration_ms, error: row.error,
    retryCount: row.retry_count, createdAt: row.created_at,
  };
}

function mapStepRow(row) {
  return {
    id: row.id, executionId: row.execution_id, workflowId: row.workflow_id,
    stepIndex: row.step_index, stepType: row.step_type,
    stepConfig: row.step_config ? JSON.parse(row.step_config) : null,
    status: row.status,
    input: row.input ? JSON.parse(row.input) : null,
    output: row.output ? JSON.parse(row.output) : null,
    error: row.error, startedAt: row.started_at, completedAt: row.completed_at,
    durationMs: row.duration_ms, createdAt: row.created_at,
  };
}

function mapTemplateRow(row) {
  return {
    id: row.id, projectId: row.project_id, name: row.name, description: row.description,
    category: row.category, triggerType: row.trigger_type,
    actions: JSON.parse(row.actions),
    conditions: row.conditions ? JSON.parse(row.conditions) : null,
    isOfficial: row.is_official === 1, useCount: row.use_count, createdAt: row.created_at,
  };
}

function mapScheduleRow(row) {
  return {
    id: row.id, workflowId: row.workflow_id, projectId: row.project_id,
    scheduleType: row.schedule_type, intervalMs: row.interval_ms,
    cronExpression: row.cron_expression, nextRunAt: row.next_run_at,
    lastRunAt: row.last_run_at, enabled: row.enabled === 1, createdAt: row.created_at,
  };
}
