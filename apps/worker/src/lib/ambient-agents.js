/**
 * Ambient agents (#38) — event-driven policies → agent runs with autonomy bounds + audit.
 */

import { executeAgentRun } from "./agent-runtime.js";
import { chatCompletion, isAiConfigured } from "./ai-chat-completion.js";
import { validateMessageContent, MAX_MESSAGE_LENGTH } from "./message-validation.js";
import { logInfo, logError } from "./worker-log.js";

const VALID_TRIGGER_TYPES = new Set(["webhook", "message_keyword", "room_event"]);
const VALID_AUTONOMY = new Set(["observe", "notify", "act"]);
const DEFAULT_COOLDOWN_SECONDS = 60;

function generateId(prefix) {
  return `${prefix}_${Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * @param {*} row
 */
export function mapAgentPolicyRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    name: String(row.name),
    triggerType: String(row.trigger_type),
    triggerPattern: String(row.trigger_pattern),
    agentId: String(row.agent_id),
    roomId: row.room_id ? String(row.room_id) : null,
    maxAutonomy: String(row.max_autonomy || "notify"),
    promptTemplate: row.prompt_template ? String(row.prompt_template) : null,
    enabled: Number(row.enabled) !== 0,
    cooldownSeconds: Number(row.cooldown_seconds) || DEFAULT_COOLDOWN_SECONDS,
    lastTriggeredAt: row.last_triggered_at ? String(row.last_triggered_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/**
 * @param {*} row
 */
export function mapAgentPolicyRunRow(row) {
  if (!row) return null;
  let triggerPayload = {};
  try {
    triggerPayload = JSON.parse(String(row.trigger_payload_json || "{}"));
  } catch {
    triggerPayload = {};
  }
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    policyId: String(row.policy_id),
    triggerType: String(row.trigger_type),
    triggerPayload,
    roomId: row.room_id ? String(row.room_id) : null,
    agentId: String(row.agent_id),
    status: String(row.status),
    autonomyLevel: String(row.autonomy_level),
    runId: row.run_id ? String(row.run_id) : null,
    messageId: row.message_id != null ? Number(row.message_id) : null,
    error: row.error ? String(row.error) : null,
    createdAt: String(row.created_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
  };
}

/**
 * @param {string} pattern
 * @param {string} haystack
 */
export function policyPatternMatches(pattern, haystack) {
  const p = String(pattern ?? "").trim();
  const h = String(haystack ?? "");
  if (!p || !h) return false;
  if (p.startsWith("/")) {
    const lastSlash = p.lastIndexOf("/");
    if (lastSlash > 0) {
      const body = p.slice(1, lastSlash);
      const flags = p.slice(lastSlash + 1);
      try {
        return new RegExp(body, flags).test(h);
      } catch {
        return h.toLowerCase().includes(body.toLowerCase());
      }
    }
  }
  return h.toLowerCase().includes(p.toLowerCase());
}

/**
 * @param {{ triggerType: string, triggerPattern: string, enabled?: boolean }} policy
 * @param {{ triggerType: string, triggerKey: string }} event
 */
export function policyMatchesEvent(policy, event) {
  if (!policy.enabled) return false;
  if (policy.triggerType !== event.triggerType) return false;
  return policyPatternMatches(policy.triggerPattern, event.triggerKey);
}

/**
 * @param {Record<string, unknown>} payload
 * @param {string | null | undefined} template
 */
export function renderAmbientPrompt(template, payload) {
  const base =
    template?.trim() ||
    "An external event occurred. Summarize impact and recommend next steps for the room.\n\nEvent: {{triggerKey}}\nPayload: {{payload}}";
  return base.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (key === "payload") return JSON.stringify(payload);
    const val = payload[key];
    return val != null ? String(val) : "";
  });
}

export function isPolicyCooldownActive(policy, nowMs = Date.now()) {
  if (!policy.lastTriggeredAt) return false;
  const last = Date.parse(policy.lastTriggeredAt);
  if (!Number.isFinite(last)) return false;
  return nowMs - last < (policy.cooldownSeconds || DEFAULT_COOLDOWN_SECONDS) * 1000;
}

export async function listAgentPolicies(env, { projectId, triggerType }) {
  let sql = `SELECT * FROM agent_policies WHERE project_id = ?`;
  const params = [projectId];
  if (triggerType) {
    sql += ` AND trigger_type = ?`;
    params.push(triggerType);
  }
  sql += ` ORDER BY updated_at DESC LIMIT 200`;
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapAgentPolicyRow);
}

export async function createAgentPolicy(env, input) {
  const name = String(input.name ?? "").trim();
  const triggerType = String(input.triggerType ?? "").trim();
  const triggerPattern = String(input.triggerPattern ?? "").trim();
  const agentId = String(input.agentId ?? "").trim();
  const maxAutonomy = String(input.maxAutonomy ?? "notify").trim();

  if (!name || name.length > 128) return { ok: false, reason: "name_required" };
  if (!VALID_TRIGGER_TYPES.has(triggerType)) return { ok: false, reason: "invalid_trigger_type" };
  if (!triggerPattern) return { ok: false, reason: "trigger_pattern_required" };
  if (!agentId) return { ok: false, reason: "agent_id_required" };
  if (!VALID_AUTONOMY.has(maxAutonomy)) return { ok: false, reason: "invalid_max_autonomy" };

  const agent = await env.DB.prepare(`SELECT id FROM bots WHERE project_id = ? AND id = ?`)
    .bind(input.projectId, agentId)
    .first();
  if (!agent) return { ok: false, reason: "agent_not_found" };

  const now = new Date().toISOString();
  const id = generateId("apol");
  await env.DB.prepare(
    `INSERT INTO agent_policies
     (id, project_id, name, trigger_type, trigger_pattern, agent_id, room_id, max_autonomy,
      prompt_template, enabled, cooldown_seconds, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
  )
    .bind(
      id,
      input.projectId,
      name,
      triggerType,
      triggerPattern,
      agentId,
      input.roomId?.trim() || null,
      maxAutonomy,
      input.promptTemplate?.trim() || null,
      Math.min(3600, Math.max(0, Number(input.cooldownSeconds) || DEFAULT_COOLDOWN_SECONDS)),
      now,
      now,
    )
    .run();

  const policy = mapAgentPolicyRow(
    await env.DB.prepare(`SELECT * FROM agent_policies WHERE id = ?`).bind(id).first(),
  );
  return { ok: true, policy };
}

export async function deleteAgentPolicy(env, { projectId, policyId }) {
  await env.DB.prepare(`DELETE FROM agent_policies WHERE id = ? AND project_id = ?`)
    .bind(policyId, projectId)
    .run();
  return { ok: true };
}

export async function listAgentPolicyRuns(env, { projectId, policyId, limit = 50 }) {
  let sql = `SELECT * FROM agent_policy_runs WHERE project_id = ?`;
  const params = [projectId];
  if (policyId) {
    sql += ` AND policy_id = ?`;
    params.push(policyId);
  }
  sql += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(Math.min(200, Math.max(1, Number(limit) || 50)));
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return (rows.results || []).map(mapAgentPolicyRunRow);
}

async function postAgentRoomMessage(env, { projectId, roomId, agentId, content }) {
  const validation = validateMessageContent(content);
  const text = validation.valid ? validation.content : String(content).slice(0, MAX_MESSAGE_LENGTH);
  const createdAt = new Date().toISOString();
  const insert = await env.DB.prepare(
    `INSERT INTO messages (project_id, room_id, user_id, content, created_at, parent_id, mentions, og_title, og_description, og_image, og_url)
     VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL)`,
  )
    .bind(projectId, roomId, agentId, text, createdAt)
    .run();
  const messageId = insert.meta.last_row_id;
  try {
    const id = env.ROOM.idFromName(roomId);
    const stub = env.ROOM.get(id);
    await stub.fetch("https://internal/announce", {
      method: "POST",
      body: JSON.stringify({ id: messageId, content: text, userId: agentId, createdAt }),
    });
  } catch {
    /* ignore */
  }
  return messageId;
}

/**
 * @param {*} env
 * @param {ReturnType<typeof mapAgentPolicyRow>} policy
 * @param {{ triggerType: string, triggerKey: string, roomId?: string, payload?: Record<string, unknown>, userId?: string, traceId?: string }} event
 */
export async function executeAmbientPolicy(env, policy, event) {
  if (isPolicyCooldownActive(policy)) {
    return { ok: false, reason: "cooldown_active", policyId: policy.id };
  }

  const roomId = policy.roomId || event.roomId;
  if (!roomId) return { ok: false, reason: "room_id_required", policyId: policy.id };

  const runId = generateId("aprun");
  const now = new Date().toISOString();
  const payload = {
    triggerKey: event.triggerKey,
    triggerType: event.triggerType,
    roomId,
    ...(event.payload || {}),
  };

  await env.DB.prepare(
    `INSERT INTO agent_policy_runs
     (id, project_id, policy_id, trigger_type, trigger_payload_json, room_id, agent_id, status, autonomy_level, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'running', ?, ?)`,
  )
    .bind(
      runId,
      policy.projectId,
      policy.id,
      event.triggerType,
      JSON.stringify(payload),
      roomId,
      policy.agentId,
      policy.maxAutonomy,
      now,
    )
    .run();

  const prompt = renderAmbientPrompt(policy.promptTemplate, payload);

  try {
    if (policy.maxAutonomy === "observe") {
      await env.DB.prepare(
        `UPDATE agent_policy_runs SET status = 'observed', completed_at = ? WHERE id = ?`,
      )
        .bind(new Date().toISOString(), runId)
        .run();
      await env.DB.prepare(
        `UPDATE agent_policies SET last_triggered_at = ?, updated_at = ? WHERE id = ?`,
      )
        .bind(new Date().toISOString(), new Date().toISOString(), policy.id)
        .run();
      logInfo("ambient.policy_observed", { policyId: policy.id, runId, roomId });
      return { ok: true, runId, status: "observed" };
    }

    const agentRow = await env.DB.prepare(
      `SELECT id, name, handle, provider, model, config, system_prompt, context_fetch_url, tool_execute_url, tools_schema, rate_limit_rpm, allowed_tools
       FROM bots WHERE project_id = ? AND id = ?`,
    )
      .bind(policy.projectId, policy.agentId)
      .first();
    if (!agentRow) throw new Error("agent_not_found");

    let agentRunId = null;
    let messageId = null;
    let status = "completed";

    if (policy.maxAutonomy === "notify") {
      if (!isAiConfigured(env)) throw new Error("ai_not_configured");
      const systemPrompt =
        agentRow.system_prompt ||
        "You are an ambient agent responding to automated room events. Be concise.";
      const llm = await chatCompletion(env, {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        maxTokens: 512,
        logContext: { projectId: policy.projectId, feature: "ambient_notify", policyId: policy.id },
      });
      if (!llm.ok) throw new Error(llm.error || "ai_failed");
      messageId = await postAgentRoomMessage(env, {
        projectId: policy.projectId,
        roomId,
        agentId: policy.agentId,
        content: llm.content,
      });
    } else {
      const result = await executeAgentRun(env, {
        agentRow,
        projectId: policy.projectId,
        roomId,
        userMessage: prompt,
        userId: event.userId || "ambient-policy",
        traceId: event.traceId || runId,
        streamHooks: null,
      });
      agentRunId = result.runId;
      status = result.status;
      if (result.status === "failed") throw new Error(result.error || "agent_run_failed");
      if (result.content) {
        messageId = await postAgentRoomMessage(env, {
          projectId: policy.projectId,
          roomId,
          agentId: policy.agentId,
          content: result.content,
        });
      }
    }

    const completedAt = new Date().toISOString();
    await env.DB.prepare(
      `UPDATE agent_policy_runs SET status = ?, run_id = ?, message_id = ?, completed_at = ? WHERE id = ?`,
    )
      .bind(status, agentRunId, messageId, completedAt, runId)
      .run();
    await env.DB.prepare(
      `UPDATE agent_policies SET last_triggered_at = ?, updated_at = ? WHERE id = ?`,
    )
      .bind(completedAt, completedAt, policy.id)
      .run();

    logInfo("ambient.policy_executed", {
      policyId: policy.id,
      runId,
      roomId,
      autonomy: policy.maxAutonomy,
      agentRunId,
    });
    return { ok: true, runId, status, messageId, agentRunId };
  } catch (err) {
    const errorText = err instanceof Error ? err.message : String(err);
    logError("ambient.policy_failed", err, { policyId: policy.id, runId });
    await env.DB.prepare(
      `UPDATE agent_policy_runs SET status = 'failed', error = ?, completed_at = ? WHERE id = ?`,
    )
      .bind(errorText.slice(0, 500), new Date().toISOString(), runId)
      .run();
    return { ok: false, reason: "execution_failed", error: errorText, runId };
  }
}

/**
 * @param {*} env
 * @param {{ projectId: string, triggerType: string, triggerKey: string, roomId?: string, payload?: Record<string, unknown>, userId?: string, traceId?: string }} event
 */
export async function dispatchAmbientEvent(env, event) {
  const policies = await listAgentPolicies(env, { projectId: event.projectId });
  const matched = policies.filter((p) =>
    policyMatchesEvent(p, { triggerType: event.triggerType, triggerKey: event.triggerKey }),
  );
  if (!matched.length) return { ok: true, matched: 0, results: [] };

  const results = [];
  for (const policy of matched) {
    if (policy.roomId && event.roomId && policy.roomId !== event.roomId) continue;
    results.push(await executeAmbientPolicy(env, policy, event));
  }
  return { ok: true, matched: matched.length, results };
}

/**
 * @param {*} env
 * @param {{ projectId: string, roomId: string, messageId?: number, content?: string, authorUserId?: string, traceId?: string }} detail
 */
export async function maybeTriggerAmbientAgentsOnMessage(env, detail) {
  if (!detail?.projectId || !detail?.roomId || !detail?.content) return;
  await dispatchAmbientEvent(env, {
    projectId: detail.projectId,
    triggerType: "message_keyword",
    triggerKey: String(detail.content),
    roomId: detail.roomId,
    payload: {
      messageId: detail.messageId,
      content: detail.content,
      authorUserId: detail.authorUserId,
    },
    userId: detail.authorUserId,
    traceId: detail.traceId,
  });
}
