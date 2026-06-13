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

export async function getWorkflow(env, { workflowId }) {
  const row = await env.DB.prepare("SELECT * FROM workflow_definitions WHERE id = ?").bind(workflowId).first();
  return row ? mapWorkflowRow(row) : null;
}

export async function listWorkflows(env, { projectId, status, triggerType, limit = 25 }) {
  let sql = "SELECT * FROM workflow_definitions WHERE project_id = ?";
  const params = [projectId];
  if (status) { sql += " AND status = ?"; params.push(status); }
  if (triggerType) { sql += " AND trigger_type = ?"; params.push(triggerType); }
  sql += " ORDER BY updated_at DESC LIMIT ?";
  params.push(limit);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapWorkflowRow);
}

// --- Executions ---

export async function startExecution(env, { workflowId, projectId, triggerData, context }) {
  const id = `wfe_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO workflow_executions (id, workflow_id, project_id, status, trigger_data, context, started_at, created_at)
     VALUES (?, ?, ?, 'running', ?, ?, ?, ?)`
  ).bind(id, workflowId, projectId, triggerData ? JSON.stringify(triggerData) : null, context ? JSON.stringify(context) : null, now, now).run();

  await env.DB.prepare(
    "UPDATE workflow_definitions SET run_count = run_count + 1, last_run_at = ?, updated_at = ? WHERE id = ?"
  ).bind(now, now, workflowId).run();

  return { id };
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
