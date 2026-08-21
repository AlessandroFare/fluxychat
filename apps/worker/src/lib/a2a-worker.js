/**
 * D1-backed A2A tasks and agent cards (roadmap #24 spike).
 */

import { safeOutboundFetch, assertSafeOutboundUrl } from "./url-ssrf.js";

function generateId(prefix) {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${prefix}_${hex}`;
}

function parseJson(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function mapTaskRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    input: parseJson(row.input_json, {}),
    output: row.output_json ? parseJson(row.output_json, null) : undefined,
    status: row.status,
    sourceAgentId: row.source_agent_id,
    targetAgentId: row.target_agent_id,
    artifacts: parseJson(row.artifacts_json, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCardRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    agentId: row.agent_id,
    name: row.name,
    description: row.description,
    capabilities: parseJson(row.capabilities_json, []),
    endpointUrl: row.endpoint_url,
    healthUrl: row.health_url,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function buildAgentCardPublic(card) {
  return {
    name: card.name,
    description: card.description ?? "",
    url: card.endpointUrl,
    version: "1.0",
    capabilities: card.capabilities ?? [],
    skills: (card.capabilities ?? []).map((c) => ({
      id: typeof c === "string" ? c : c.id,
      name: typeof c === "string" ? c : c.name ?? c.id,
    })),
    authentication: { schemes: ["bearer"] },
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"],
  };
}

export async function upsertA2AAgentCard(env, input) {
  const { projectId, agentId, name, description, capabilities, endpointUrl, healthUrl, status } = input;
  if (!projectId || !agentId || !name) return { ok: false, error: "missing_fields" };

  const existing = await env.DB.prepare(
    `SELECT id FROM a2a_agent_cards WHERE project_id = ? AND agent_id = ?`,
  )
    .bind(projectId, agentId)
    .first();

  const now = new Date().toISOString();
  const capsJson = capabilities ? JSON.stringify(capabilities) : null;

  if (existing?.id) {
    await env.DB.prepare(
      `UPDATE a2a_agent_cards SET name = ?, description = ?, capabilities_json = ?, endpoint_url = ?, health_url = ?, status = ?, updated_at = ?
       WHERE id = ?`,
    )
      .bind(name, description ?? null, capsJson, endpointUrl ?? null, healthUrl ?? null, status ?? "active", now, existing.id)
      .run();
    const row = await env.DB.prepare(`SELECT * FROM a2a_agent_cards WHERE id = ?`).bind(existing.id).first();
    return { ok: true, card: mapCardRow(row) };
  }

  const id = generateId("aac");
  await env.DB.prepare(
    `INSERT INTO a2a_agent_cards (id, project_id, agent_id, name, description, capabilities_json, endpoint_url, health_url, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, projectId, agentId, name, description ?? null, capsJson, endpointUrl ?? null, healthUrl ?? null, status ?? "active", now, now)
    .run();

  const row = await env.DB.prepare(`SELECT * FROM a2a_agent_cards WHERE id = ?`).bind(id).first();
  return { ok: true, card: mapCardRow(row) };
}

export async function getA2AAgentCard(env, { projectId, agentId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM a2a_agent_cards WHERE project_id = ? AND agent_id = ?`,
  )
    .bind(projectId, agentId)
    .first();
  return row ? mapCardRow(row) : null;
}

export async function listA2AAgentCards(env, { projectId }) {
  const rows = await env.DB.prepare(
    `SELECT * FROM a2a_agent_cards WHERE project_id = ? ORDER BY updated_at DESC`,
  )
    .bind(projectId)
    .all();
  return (rows.results || []).map(mapCardRow);
}

export async function createA2ATask(env, input) {
  const { projectId, title, taskInput, sourceAgentId, targetAgentId } = input;
  if (!projectId || !title) return { ok: false, error: "missing_fields" };

  const id = generateId("a2t");
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO a2a_tasks (id, project_id, title, input_json, status, source_agent_id, target_agent_id, artifacts_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?, '[]', ?, ?)`,
  )
    .bind(id, projectId, title, JSON.stringify(taskInput ?? {}), sourceAgentId ?? null, targetAgentId ?? null, now, now)
    .run();

  const row = await env.DB.prepare(`SELECT * FROM a2a_tasks WHERE id = ?`).bind(id).first();
  return { ok: true, task: mapTaskRow(row) };
}

export async function getA2ATask(env, { projectId, taskId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM a2a_tasks WHERE project_id = ? AND id = ?`,
  )
    .bind(projectId, taskId)
    .first();
  return row ? mapTaskRow(row) : null;
}

export async function listA2ATasks(env, { projectId, limit = 50 }) {
  const rows = await env.DB.prepare(
    `SELECT * FROM a2a_tasks WHERE project_id = ? ORDER BY created_at DESC LIMIT ?`,
  )
    .bind(projectId, Math.min(limit, 200))
    .all();
  return (rows.results || []).map(mapTaskRow);
}

export async function updateA2ATaskStatus(env, { projectId, taskId, status, output, artifacts }) {
  const allowed = ["pending", "working", "completed", "failed", "cancelled"];
  if (!allowed.includes(status)) return { ok: false, error: "invalid_status" };

  const existing = await getA2ATask(env, { projectId, taskId });
  if (!existing) return { ok: false, error: "not_found" };

  const now = new Date().toISOString();
  const outputJson = output != null ? JSON.stringify(output) : existing.output ? JSON.stringify(existing.output) : null;
  const artifactsJson = artifacts != null ? JSON.stringify(artifacts) : JSON.stringify(existing.artifacts ?? []);

  await env.DB.prepare(
    `UPDATE a2a_tasks SET status = ?, output_json = ?, artifacts_json = ?, updated_at = ? WHERE id = ? AND project_id = ?`,
  )
    .bind(status, outputJson, artifactsJson, now, taskId, projectId)
    .run();

  return { ok: true, task: await getA2ATask(env, { projectId, taskId }) };
}

export async function sendA2AEnvelope(env, input) {
  const { projectId, sourceAgentId, targetAgentId, taskId, status, extensions } = input;
  if (!projectId || !sourceAgentId || !targetAgentId || !taskId) {
    return { ok: false, error: "missing_fields" };
  }

  const id = generateId("a2e");
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO a2a_envelopes (id, project_id, source_agent_id, target_agent_id, task_id, status, extensions_json, delivered, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
  )
    .bind(
      id,
      projectId,
      sourceAgentId,
      targetAgentId,
      taskId,
      status ?? "pending",
      extensions ? JSON.stringify(extensions) : null,
      now,
    )
    .run();

  return {
    ok: true,
    envelope: {
      id,
      source: sourceAgentId,
      target: targetAgentId,
      taskId,
      status: status ?? "pending",
      extensions: extensions ?? {},
      createdAt: now,
    },
  };
}

export async function receiveA2AEnvelopes(env, { projectId, agentId, markDelivered = true }) {
  const rows = await env.DB.prepare(
    `SELECT * FROM a2a_envelopes WHERE project_id = ? AND target_agent_id = ? AND delivered = 0 ORDER BY created_at ASC LIMIT 50`,
  )
    .bind(projectId, agentId)
    .all();

  const envelopes = (rows.results || []).map((row) => ({
    id: row.id,
    source: row.source_agent_id,
    target: row.target_agent_id,
    taskId: row.task_id,
    status: row.status,
    extensions: parseJson(row.extensions_json, {}),
    createdAt: row.created_at,
  }));

  if (markDelivered && envelopes.length) {
    const ids = envelopes.map((e) => e.id);
    const ph = ids.map(() => "?").join(",");
    await env.DB.prepare(
      `UPDATE a2a_envelopes SET delivered = 1 WHERE project_id = ? AND id IN (${ph})`,
    )
      .bind(projectId, ...ids)
      .run();
  }

  return { ok: true, envelopes };
}

export async function pingA2AAgentHealth(env, { healthUrl, endpointUrl }) {
  const url = String(healthUrl || endpointUrl || "").trim();
  if (!url) return { ok: false, error: "missing_url" };
  const validated = validateExternalHttpsUrl(url, env);
  if (!validated.ok) return { ok: false, error: validated.error };
  try {
    const res = await safeOutboundFetch(
      validated.url,
      { method: "GET", signal: AbortSignal.timeout(8000) },
      env,
    );
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: err?.message || "network_error" };
  }
}

/**
 * HTTPS-only external URL validation (blocks obvious SSRF targets).
 * @param {string} raw
 * @param {unknown} [env]
 */
export function validateExternalHttpsUrl(raw, env) {
  const input = String(raw || "").trim();
  if (!input) return { ok: false, error: "missing_url" };
  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    return { ok: false, error: "invalid_url" };
  }
  if (parsed.protocol !== "https:") return { ok: false, error: "https_required" };
  try {
    assertSafeOutboundUrl(parsed.toString(), env);
  } catch {
    return { ok: false, error: "ssrf_blocked" };
  }
  return { ok: true, url: parsed.toString() };
}

/**
 * Fetch remote Agent Card JSON (A2A discovery).
 */
export async function fetchExternalAgentCard(cardUrl, { bearerToken, env } = {}) {
  const validated = validateExternalHttpsUrl(cardUrl, env);
  if (!validated.ok) return { ok: false, error: validated.error };

  const headers = { Accept: "application/json" };
  if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;

  try {
    const res = await safeOutboundFetch(
      validated.url,
      {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(10000),
      },
      env,
    );
    if (!res.ok) return { ok: false, error: `http_${res.status}` };
    const card = await res.json();
    if (!card || typeof card !== "object") return { ok: false, error: "invalid_card" };
    return { ok: true, card };
  } catch (err) {
    return { ok: false, error: err?.message || "fetch_failed" };
  }
}

/**
 * Delegate a pending task to a remote agent endpoint (production A2A path).
 */
export async function delegateA2ATaskToRemote(env, { projectId, taskId, targetAgentId, bearerToken }) {
  const task = await getA2ATask(env, { projectId, taskId });
  if (!task) return { ok: false, error: "task_not_found" };

  const card = await getA2AAgentCard(env, { projectId, agentId: targetAgentId ?? task.targetAgentId });
  if (!card?.endpointUrl) return { ok: false, error: "missing_endpoint" };

  const validated = validateExternalHttpsUrl(card.endpointUrl, env);
  if (!validated.ok) return { ok: false, error: validated.error };

  const token = bearerToken || env.A2A_OUTBOUND_BEARER || "";
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  await updateA2ATaskStatus(env, { projectId, taskId, status: "working" });

  try {
    const res = await safeOutboundFetch(
      validated.url,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tasks/send",
          id: taskId,
          params: {
            id: taskId,
            message: task.input,
            metadata: { sourceAgentId: task.sourceAgentId, projectId },
          },
        }),
        signal: AbortSignal.timeout(30000),
      },
      env,
    );

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      await updateA2ATaskStatus(env, {
        projectId,
        taskId,
        status: "failed",
        output: { error: body?.error || `http_${res.status}` },
      });
      return { ok: false, error: "delegation_failed", status: res.status };
    }

    const output = body?.result ?? body;
    await updateA2ATaskStatus(env, {
      projectId,
      taskId,
      status: "completed",
      output,
      artifacts: Array.isArray(output?.artifacts) ? output.artifacts : undefined,
    });

    return { ok: true, task: await getA2ATask(env, { projectId, taskId }), output };
  } catch (err) {
    await updateA2ATaskStatus(env, {
      projectId,
      taskId,
      status: "failed",
      output: { error: err?.message || "network_error" },
    });
    return { ok: false, error: err?.message || "network_error" };
  }
}
