/**
 * P16-D: AI Actions Hub
 *
 * Built-in actions that AI agents can execute:
 *   - webhook: Call an external URL with POST
 *   - email: Send an email via EMAIL binding
 *   - ticket: Create a support ticket (D1)
 *   - github_issue: Create a GitHub issue via API
 *   - custom: User-defined action via toolExecuteUrl
 *
 * Actions are registered per-project and can be invoked by agents
 * during tool calling, increasing switching cost and retention.
 */

import { logInfo, logError } from "./worker-log.js";

const ACTION_HANDLERS = {
  webhook: executeWebhook,
  email: executeEmail,
  ticket: executeTicket,
  github_issue: executeGitHubIssue,
  custom: executeCustom,
};

/**
 * List all actions for a project.
 */
export async function listActions(env, { projectId, enabled }) {
  let sql = `SELECT id, name, description, kind, config, enabled, created_at, updated_at
    FROM ai_actions WHERE project_id = ?`;
  const params = [projectId];
  if (enabled !== undefined) {
    sql += " AND enabled = ?";
    params.push(enabled ? 1 : 0);
  }
  sql += " ORDER BY created_at DESC";
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(parseAction);
}

/**
 * Get a single action by ID.
 */
export async function getAction(env, { projectId, actionId }) {
  const row = await env.DB.prepare(
    `SELECT id, name, description, kind, config, enabled, created_at, updated_at
     FROM ai_actions WHERE id = ? AND project_id = ?`
  )
    .bind(actionId, projectId)
    .first();
  return row ? parseAction(row) : null;
}

/**
 * Create a new action.
 */
export async function createAction(env, { projectId, name, description, kind, config }) {
  const id = `action_${crypto.randomUUID().slice(0, 12)}`;
  const now = new Date().toISOString();
  const configJson = JSON.stringify(config);

  await env.DB.prepare(
    `INSERT INTO ai_actions (id, project_id, name, description, kind, config, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`
  )
    .bind(id, projectId, name, description || null, kind, configJson, now, now)
    .run();

  return { id, name, description, kind, config, enabled: true, createdAt: now, updatedAt: now };
}

/**
 * Update an action.
 */
export async function updateAction(env, { projectId, actionId, name, description, kind, config, enabled }) {
  const existing = await getAction(env, { projectId, actionId });
  if (!existing) return null;

  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE ai_actions SET name = ?, description = ?, kind = ?, config = ?, enabled = ?, updated_at = ?
     WHERE id = ? AND project_id = ?`
  )
    .bind(
      name ?? existing.name,
      description !== undefined ? description : existing.description,
      kind ?? existing.kind,
      config ? JSON.stringify(config) : JSON.stringify(existing.config),
      enabled !== undefined ? (enabled ? 1 : 0) : (existing.enabled ? 1 : 0),
      now,
      actionId,
      projectId,
    )
    .run();

  return getAction(env, { projectId, actionId });
}

/**
 * Delete an action.
 */
export async function deleteAction(env, { projectId, actionId }) {
  await env.DB.prepare(`DELETE FROM ai_actions WHERE id = ? AND project_id = ?`)
    .bind(actionId, projectId)
    .run();
  return { ok: true };
}

/**
 * Execute an action by ID.
 */
export async function executeAction(env, { projectId, actionId, roomId, userId, input, traceId }) {
  const action = await getAction(env, { projectId, actionId });
  if (!action) return { ok: false, error: "action_not_found" };
  if (!action.enabled) return { ok: false, error: "action_disabled" };

  const execId = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    const handler = ACTION_HANDLERS[action.kind];
    if (!handler) {
      return { ok: false, error: `unsupported_action_kind: ${action.kind}` };
    }

    const result = await handler(env, { action, input, projectId, roomId, userId, traceId });

    await env.DB.prepare(
      `INSERT INTO ai_action_executions (id, project_id, action_id, room_id, user_id, input, output, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'success', ?)`
    )
      .bind(execId, projectId, actionId, roomId || null, userId || null, JSON.stringify(input), JSON.stringify(result), now)
      .run();

    logInfo("ai_action.executed", { projectId, actionId, actionName: action.name, kind: action.kind, execId, roomId });
    return { ok: true, result, executionId: execId };
  } catch (err) {
    const error = err.message || "execution_failed";
    await env.DB.prepare(
      `INSERT INTO ai_action_executions (id, project_id, action_id, room_id, user_id, input, output, status, error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'failed', ?, ?)`
    )
      .bind(execId, projectId, actionId, roomId || null, userId || null, JSON.stringify(input), null, error, now)
      .run();

    logError("ai_action.execution_failed", err, { projectId, actionId, execId });
    return { ok: false, error };
  }
}

/**
 * Get recent executions for an action or project.
 */
export async function listExecutions(env, { projectId, actionId, limit = 20 }) {
  let sql = `SELECT id, action_id, room_id, user_id, input, output, status, error, created_at
    FROM ai_action_executions WHERE project_id = ?`;
  const params = [projectId];
  if (actionId) {
    sql += " AND action_id = ?";
    params.push(actionId);
  }
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(Math.min(limit, 100));
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map((r) => ({
    id: r.id,
    actionId: r.action_id,
    roomId: r.room_id,
    userId: r.user_id,
    input: tryParse(r.input),
    output: tryParse(r.output),
    status: r.status,
    error: r.error,
    createdAt: r.created_at,
  }));
}

/**
 * Build MCP tool definitions from registered actions.
 * These get added to the MCP server's tools/list response.
 */
export async function buildActionTools(env, { projectId }) {
  const actions = await listActions(env, { projectId, enabled: true });
  return actions.map((a) => ({
    name: `action_${a.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`,
    description: a.description || `Execute action: ${a.name} (${a.kind})`,
    inputSchema: buildInputSchema(a),
    _actionId: a.id,
  }));
}

function buildInputSchema(action) {
  switch (action.kind) {
    case "webhook":
      return {
        type: "object",
        properties: {
          payload: { type: "object", description: "JSON payload to send" },
        },
        required: ["payload"],
      };
    case "email":
      return {
        type: "object",
        properties: {
          to: { type: "string", description: "Recipient email" },
          subject: { type: "string", description: "Email subject" },
          body: { type: "string", description: "Email body (HTML or text)" },
        },
        required: ["to", "subject", "body"],
      };
    case "ticket":
      return {
        type: "object",
        properties: {
          title: { type: "string", description: "Ticket title" },
          description: { type: "string", description: "Ticket description" },
          priority: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "Priority" },
        },
        required: ["title"],
      };
    case "github_issue":
      return {
        type: "object",
        properties: {
          repo: { type: "string", description: "Owner/repo" },
          title: { type: "string", description: "Issue title" },
          body: { type: "string", description: "Issue body" },
          labels: { type: "array", items: { type: "string" }, description: "Labels" },
        },
        required: ["repo", "title"],
      };
    default:
      return {
        type: "object",
        properties: {
          payload: { type: "object", description: "Action-specific payload" },
        },
      };
  }
}

// --- Action Handlers ---

async function executeWebhook(env, { action, input }) {
  const config = action.config;
  const url = config.url;
  if (!url) throw new Error("webhook action requires config.url");

  const method = config.method || "POST";
  const headers = { "Content-Type": "application/json", ...config.headers };
  const body = JSON.stringify(input.payload || input);

  const res = await fetch(url, { method, headers, body, redirect: "follow" });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new Error(`webhook HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return { status: res.status, data };
}

async function executeEmail(env, { input }) {
  const { to, subject, body } = input;
  if (!to || !subject || !body) throw new Error("email requires to, subject, body");

  if (!env.EMAIL) {
    throw new Error("EMAIL binding not configured");
  }

  await env.EMAIL.send({
    to,
    subject,
    html: body,
  });

  return { sent: true, to, subject };
}

async function executeTicket(env, { input, projectId, roomId, userId }) {
  const { title, description, priority } = input;
  if (!title) throw new Error("ticket requires title");

  const ticketId = `ticket_${crypto.randomUUID().slice(0, 12)}`;
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO ai_action_executions (id, project_id, action_id, room_id, user_id, input, output, status, created_at)
     VALUES (?, ?, '_ticket', ?, ?, ?, ?, 'success', ?)`
  )
    .bind(ticketId, projectId, roomId || null, userId || null, JSON.stringify({ title, description, priority }), JSON.stringify({ ticketId, status: "open" }), now)
    .run();

  return { ticketId, status: "open", title, priority: priority || "medium" };
}

async function executeGitHubIssue(env, { action, input }) {
  const { repo, title, body, labels } = input;
  if (!repo || !title) throw new Error("github_issue requires repo and title");

  const token = action.config.github_token || action.config.githubToken;
  if (!token) throw new Error("github_issue requires config.github_token");

  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, body: body || "", labels: labels || [] }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return { issueNumber: data.number, url: data.html_url, state: data.state };
}

async function executeCustom(env, { action, input }) {
  const url = action.config.toolExecuteUrl || action.config.url;
  if (!url) throw new Error("custom action requires config.url");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = await res.json();
  return { status: res.status, data };
}

// --- Helpers ---

function parseAction(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    kind: row.kind,
    config: tryParse(row.config),
    enabled: !!row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function tryParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return json;
  }
}
