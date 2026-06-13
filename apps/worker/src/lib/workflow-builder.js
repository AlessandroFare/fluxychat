function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const VALID_TRIGGERS = ["message", "join", "keyword", "schedule", "webhook", "reaction", "mention"];
const VALID_ACTIONS = ["send_message", "add_reaction", "assign_task", "call_webhook", "run_ai", "update_status", "forward_room", "delay", "condition", "branch"];

export async function createWorkflow(env, { projectId, name, description, triggerType, triggerConfig, steps }) {
  if (!name || !triggerType) return { error: "name and triggerType are required" };
  if (!VALID_TRIGGERS.includes(triggerType)) return { error: `triggerType must be one of: ${VALID_TRIGGERS.join(", ")}` };

  const id = `wf_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO workflow_definitions (id, project_id, name, description, trigger_type, trigger_config, steps, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, projectId, name, description || null, triggerType, triggerConfig ? JSON.stringify(triggerConfig) : null, JSON.stringify(steps || []), now, now)
    .run();
  return { id, created: true };
}

export async function updateWorkflow(env, { id, projectId, name, description, triggerType, triggerConfig, steps, enabled }) {
  const now = new Date().toISOString();
  const sets = ["updated_at = ?"];
  const params = [now];

  if (name !== undefined) { sets.push("name = ?"); params.push(name); }
  if (description !== undefined) { sets.push("description = ?"); params.push(description); }
  if (triggerType !== undefined) { sets.push("trigger_type = ?"); params.push(triggerType); }
  if (triggerConfig !== undefined) { sets.push("trigger_config = ?"); params.push(JSON.stringify(triggerConfig)); }
  if (steps !== undefined) { sets.push("steps = ?"); params.push(JSON.stringify(steps)); }
  if (enabled !== undefined) { sets.push("enabled = ?"); params.push(enabled ? 1 : 0); }

  params.push(id, projectId);
  const result = await env.DB.prepare(
    `UPDATE workflow_definitions SET ${sets.join(", ")} WHERE id = ? AND project_id = ?`
  )
    .bind(...params)
    .run();
  return { updated: result.meta?.changes || 0 };
}

export async function getWorkflow(env, { id, projectId }) {
  const row = await env.DB.prepare(
    "SELECT * FROM workflow_definitions WHERE id = ? AND project_id = ?"
  )
    .bind(id, projectId)
    .first();
  return row ? mapWorkflowRow(row) : null;
}

export async function listWorkflows(env, { projectId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM workflow_definitions WHERE project_id = ? ORDER BY created_at DESC"
  )
    .bind(projectId)
    .all();
  return (rows.results || []).map(mapWorkflowRow);
}

export async function deleteWorkflow(env, { id, projectId }) {
  const result = await env.DB.prepare(
    "DELETE FROM workflow_definitions WHERE id = ? AND project_id = ?"
  )
    .bind(id, projectId)
    .run();
  return { deleted: result.meta?.changes || 0 };
}

export async function executeWorkflow(env, { workflowId, projectId, triggerData }) {
  const workflow = await getWorkflow(env, { id: workflowId, projectId });
  if (!workflow) return { error: "workflow_not_found" };
  if (!workflow.enabled) return { error: "workflow_disabled" };

  const runId = `wfr_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO workflow_runs (id, workflow_id, project_id, status, trigger_data, started_at)
     VALUES (?, ?, ?, 'running', ?, ?)`
  )
    .bind(runId, workflowId, projectId, triggerData ? JSON.stringify(triggerData) : null, now)
    .run();

  const steps = workflow.steps || [];
  let currentStep = 0;
  const results = [];

  while (currentStep < steps.length) {
    const step = steps[currentStep];
    const stepResult = await executeStep(env, step, { projectId, triggerData, results });
    results.push({ step: currentStep, action: step.action, result: stepResult });

    if (stepResult.error) {
      await env.DB.prepare(
        "UPDATE workflow_runs SET status = 'failed', result = ?, error = ?, completed_at = ?, duration_ms = ? WHERE id = ?"
      )
        .bind(JSON.stringify(results), stepResult.error, new Date().toISOString(), Date.now() - new Date(now).getTime(), runId)
        .run();
      return { runId, status: "failed", error: stepResult.error, results };
    }

    if (step.action === "branch" && stepResult.nextStep !== undefined) {
      currentStep = stepResult.nextStep;
    } else if (step.action === "condition" && stepResult.condition === false) {
      currentStep = step.skipTo !== undefined ? step.skipTo : currentStep + 1;
    } else {
      currentStep++;
    }
  }

  const durationMs = Date.now() - new Date(now).getTime();
  await env.DB.prepare(
    "UPDATE workflow_runs SET status = 'completed', result = ?, completed_at = ?, duration_ms = ? WHERE id = ?"
  )
    .bind(JSON.stringify(results), new Date().toISOString(), durationMs, runId)
    .run();

  await env.DB.prepare(
    "UPDATE workflow_definitions SET run_count = run_count + 1, last_run_at = ? WHERE id = ?"
  )
    .bind(now, workflowId)
    .run();

  return { runId, status: "completed", results, durationMs };
}

async function executeStep(env, step, context) {
  try {
    switch (step.action) {
      case "send_message":
        return { sent: true, roomId: step.roomId, message: step.message };
      case "add_reaction":
        return { reacted: true, emoji: step.emoji };
      case "assign_task":
        return { assigned: true, assignee: step.assignee, task: step.task };
      case "call_webhook":
        return { called: true, url: step.url, status: 200 };
      case "run_ai":
        return { aiResult: "processed", prompt: step.prompt };
      case "update_status":
        return { statusUpdated: true, status: step.status };
      case "forward_room":
        return { forwarded: true, targetRoom: step.targetRoom };
      case "delay":
        return { delayed: true, ms: step.ms || 1000 };
      case "condition":
        return { condition: true };
      case "branch":
        return { nextStep: step.nextStep || 0 };
      default:
        return { unknown: true };
    }
  } catch (err) {
    return { error: err.message };
  }
}

export async function getWorkflowRuns(env, { workflowId, projectId, limit }) {
  let sql = "SELECT * FROM workflow_runs WHERE project_id = ?";
  const params = [projectId];
  if (workflowId) { sql += " AND workflow_id = ?"; params.push(workflowId); }
  sql += " ORDER BY started_at DESC LIMIT ?";
  params.push(limit || 20);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapRunRow);
}

export async function createTemplate(env, { projectId, name, description, category, triggerType, triggerConfig, steps, isSystem }) {
  if (!name || !triggerType) return { error: "name and triggerType are required" };

  const id = `wft_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO workflow_templates (id, project_id, name, description, category, trigger_type, trigger_config, steps, is_system, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, projectId, name, description || null, category || "general", triggerType, triggerConfig ? JSON.stringify(triggerConfig) : null, JSON.stringify(steps || []), isSystem ? 1 : 0, now)
    .run();
  return { id, created: true };
}

export async function listTemplates(env, { projectId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM workflow_templates WHERE project_id = ? OR is_system = 1 ORDER BY use_count DESC"
  )
    .bind(projectId)
    .all();
  return (rows.results || []).map(mapTemplateRow);
}

export async function applyTemplate(env, { templateId, projectId }) {
  const template = await env.DB.prepare(
    "SELECT * FROM workflow_templates WHERE id = ? AND (project_id = ? OR is_system = 1)"
  )
    .bind(templateId, projectId)
    .first();
  if (!template) return { error: "template_not_found" };

  const result = await createWorkflow(env, {
    projectId, name: template.name, description: template.description,
    triggerType: template.trigger_type,
    triggerConfig: template.trigger_config ? JSON.parse(template.trigger_config) : undefined,
    steps: template.steps ? JSON.parse(template.steps) : [],
  });

  if (!result.error) {
    await env.DB.prepare("UPDATE workflow_templates SET use_count = use_count + 1 WHERE id = ?").bind(templateId).run();
  }

  return result;
}

export async function getWorkflowStats(env, { projectId }) {
  const workflows = await env.DB.prepare(
    "SELECT trigger_type, COUNT(*) as count, SUM(run_count) as runs FROM workflow_definitions WHERE project_id = ? GROUP BY trigger_type"
  )
    .bind(projectId)
    .all();

  const runs = await env.DB.prepare(
    "SELECT status, COUNT(*) as count, AVG(duration_ms) as avg_duration FROM workflow_runs WHERE project_id = ? GROUP BY status"
  )
    .bind(projectId)
    .all();

  return {
    totalWorkflows: (workflows.results || []).reduce((s, w) => s + w.count, 0),
    totalRuns: (workflows.results || []).reduce((s, w) => s + (w.runs || 0), 0),
    byTrigger: (workflows.results || []).map((w) => ({ trigger: w.trigger_type, count: w.count, runs: w.runs })),
    byStatus: (runs.results || []).map((r) => ({ status: r.status, count: r.count, avgDuration: Math.round(r.avg_duration || 0) })),
  };
}

function mapWorkflowRow(row) {
  return {
    id: row.id, projectId: row.project_id, name: row.name, description: row.description,
    triggerType: row.trigger_type, triggerConfig: row.trigger_config ? JSON.parse(row.trigger_config) : null,
    steps: row.steps ? JSON.parse(row.steps) : [], enabled: row.enabled === 1,
    runCount: row.run_count, lastRunAt: row.last_run_at,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapRunRow(row) {
  return {
    id: row.id, workflowId: row.workflow_id, projectId: row.project_id,
    status: row.status, triggerData: row.trigger_data ? JSON.parse(row.trigger_data) : null,
    result: row.result ? JSON.parse(row.result) : null, error: row.error,
    startedAt: row.started_at, completedAt: row.completed_at, durationMs: row.duration_ms,
  };
}

function mapTemplateRow(row) {
  return {
    id: row.id, projectId: row.project_id, name: row.name, description: row.description,
    category: row.category, triggerType: row.trigger_type,
    triggerConfig: row.trigger_config ? JSON.parse(row.trigger_config) : null,
    steps: row.steps ? JSON.parse(row.steps) : [], useCount: row.use_count,
    isSystem: row.is_system === 1, createdAt: row.created_at,
  };
}
