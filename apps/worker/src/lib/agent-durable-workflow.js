/**
 * CP-071: D1-backed durable WorkflowAgent with resume support.
 */
import { createWorkflowAgent } from "./workflow-agent.js";

function generateId() {
  return `adw_${crypto.randomUUID().slice(0, 12)}`;
}

/**
 * @param {*} env
 * @param {string} projectId
 */
export function createD1WorkflowStore(env, projectId) {
  return {
    async save(state) {
      const now = new Date().toISOString();
      await env.DB.prepare(
        `UPDATE agent_durable_workflows
         SET state_json = ?, status = ?, updated_at = ?, completed_at = ?
         WHERE id = ? AND project_id = ?`,
      )
        .bind(
          JSON.stringify(state),
          state.status,
          now,
          state.completedAt || null,
          state.workflowId,
          projectId,
        )
        .run();
    },

    async get(workflowId) {
      const row = await env.DB.prepare(
        `SELECT state_json FROM agent_durable_workflows WHERE id = ? AND project_id = ?`,
      )
        .bind(workflowId, projectId)
        .first();
      if (!row?.state_json) return null;
      try {
        return JSON.parse(row.state_json);
      } catch {
        return null;
      }
    },

    async list(filter = {}) {
      let sql = `SELECT id, state_json, status FROM agent_durable_workflows WHERE project_id = ?`;
      const params = [projectId];
      if (filter.status) {
        sql += " AND status = ?";
        params.push(filter.status);
      }
      sql += " ORDER BY updated_at DESC LIMIT ?";
      params.push(filter.limit || 25);
      const rows = await env.DB.prepare(sql).bind(...params).all();
      return (rows.results || [])
        .map((r) => {
          try {
            return JSON.parse(r.state_json);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    },

    async delete(workflowId) {
      await env.DB.prepare(
        `DELETE FROM agent_durable_workflows WHERE id = ? AND project_id = ?`,
      )
        .bind(workflowId, projectId)
        .run();
    },
  };
}

/**
 * @param {*} env
 * @param {{ projectId: string, name: string, definition: object, input?: object, executeStep: Function }} opts
 */
export async function startDurableWorkflow(env, opts) {
  const id = generateId();
  const now = new Date().toISOString();
  const definition = {
    ...opts.definition,
    id,
    steps: (opts.definition?.steps || []).map((s) => ({
      ...s,
      status: s.status || "pending",
      retryAttempts: s.retryAttempts || 0,
    })),
  };

  const initialState = {
    workflowId: id,
    status: "running",
    completedSteps: [],
    variables: { ...(definition.variables || {}), ...(opts.input || {}) },
    createdAt: now,
    updatedAt: now,
  };

  await env.DB.prepare(
    `INSERT INTO agent_durable_workflows
     (id, project_id, name, definition_json, state_json, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'running', ?, ?)`,
  )
    .bind(id, opts.projectId, opts.name, JSON.stringify(definition), JSON.stringify(initialState), now, now)
    .run();

  const store = createD1WorkflowStore(env, opts.projectId);
  const agent = createWorkflowAgent({
    store,
    executeStep: opts.executeStep,
    onStepComplete: opts.onStepComplete,
    onWorkflowComplete: opts.onWorkflowComplete,
  });

  const state = await agent.continue(definition, initialState);
  return { ok: true, workflowId: id, state, definition };
}

/**
 * @param {*} env
 * @param {{ projectId: string, workflowId: string, executeStep: Function }} opts
 */
export async function resumeDurableWorkflow(env, opts) {
  const row = await env.DB.prepare(
    `SELECT definition_json, state_json, status FROM agent_durable_workflows
     WHERE id = ? AND project_id = ?`,
  )
    .bind(opts.workflowId, opts.projectId)
    .first();

  if (!row) return { ok: false, error: "not_found" };
  if (row.status === "completed" || row.status === "cancelled") {
    return { ok: false, error: "already_terminal", status: row.status };
  }

  let definition;
  let state;
  try {
    definition = JSON.parse(row.definition_json);
    state = JSON.parse(row.state_json);
  } catch {
    return { ok: false, error: "corrupt_state" };
  }

  state.status = "running";
  state.updatedAt = new Date().toISOString();

  const store = createD1WorkflowStore(env, opts.projectId);
  const agent = createWorkflowAgent({
    store,
    executeStep: opts.executeStep,
    onStepComplete: opts.onStepComplete,
    onWorkflowComplete: opts.onWorkflowComplete,
  });

  const finalState = await agent.continue(definition, state);
  return { ok: true, state: finalState };
}

export async function getDurableWorkflow(env, { projectId, workflowId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM agent_durable_workflows WHERE id = ? AND project_id = ?`,
  )
    .bind(workflowId, projectId)
    .first();
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    status: row.status,
    definition: JSON.parse(row.definition_json),
    state: JSON.parse(row.state_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

export async function listDurableWorkflows(env, { projectId, status, limit = 25 }) {
  let sql = `SELECT id, name, status, created_at, updated_at, completed_at
             FROM agent_durable_workflows WHERE project_id = ?`;
  const params = [projectId];
  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }
  sql += " ORDER BY updated_at DESC LIMIT ?";
  params.push(Math.min(limit, 100));
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    completedAt: r.completed_at,
  }));
}

/**
 * Resume stuck workflows (cron). Uses noop executeStep — caller should pass real executor in prod cron hook.
 * @param {*} env
 * @param {{ executeStep?: Function, limit?: number }} [opts]
 */
export async function resumeStuckDurableWorkflows(env, opts = {}) {
  const limit = opts.limit || 10;
  const rows = await env.DB.prepare(
    `SELECT id, project_id FROM agent_durable_workflows
     WHERE status IN ('running', 'paused')
     ORDER BY updated_at ASC LIMIT ?`,
  )
    .bind(limit)
    .all();

  const executeStep =
    opts.executeStep ||
    (async (step) => ({ skipped: true, stepId: step.id, reason: "cron_no_executor" }));

  const results = [];
  for (const row of rows.results || []) {
    const result = await resumeDurableWorkflow(env, {
      projectId: row.project_id,
      workflowId: row.id,
      executeStep,
    });
    results.push({ workflowId: row.id, ...result });
  }
  return { resumed: results.length, results };
}
