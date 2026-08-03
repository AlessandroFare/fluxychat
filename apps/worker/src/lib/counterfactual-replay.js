/**
 * Counterfactual Replay (#44) — re-run a tool_call with modified params on a branch.
 */

import { branchRoomFromMessage } from "./message-branch.js";
import { executeToolCall } from "./agent-tools.js";
import { truncateForStorage } from "./storage-utils.js";

const SIDE_EFFECT_PATTERNS = [
  /send_email/i,
  /send_mail/i,
  /payment/i,
  /charge/i,
  /checkout/i,
  /purchase/i,
  /transfer/i,
  /delete_/i,
  /create_invoice/i,
  /refund/i,
];

/** @param {string} toolName */
export function isSideEffectTool(toolName) {
  return SIDE_EFFECT_PATTERNS.some((re) => re.test(String(toolName || "")));
}

/** @param {unknown} raw */
export function parseToolCallsJson(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** @param {Record<string, unknown>} base @param {Record<string, unknown>} patch */
export function mergeToolArguments(base, patch) {
  const merged = { ...(base || {}) };
  for (const [key, value] of Object.entries(patch || {})) {
    merged[key] = value;
  }
  return merged;
}

/** @param {*} row */
export function mapAgentRunRow(row) {
  if (!row) return null;
  const toolCalls = parseToolCallsJson(row.tool_calls_json);
  let modifiedParams = null;
  if (row.modified_params) {
    try {
      modifiedParams = JSON.parse(String(row.modified_params));
    } catch {
      modifiedParams = null;
    }
  }
  return {
    id: String(row.id),
    agent_id: String(row.agent_id),
    room_id: row.room_id ? String(row.room_id) : null,
    status: String(row.status),
    latency_ms: Number(row.latency_ms) || 0,
    error: row.error ? String(row.error) : null,
    tool_calls: toolCalls,
    branch_id: row.branch_id ? String(row.branch_id) : null,
    counterfactual_of: row.counterfactual_of ? String(row.counterfactual_of) : null,
    modified_params: modifiedParams,
    created_at: String(row.created_at),
  };
}

/** @param {*} env @param {string} projectId @param {string} runId */
export async function getAgentRunRecord(env, projectId, runId) {
  return env.DB.prepare(
    `SELECT id, project_id, agent_id, room_id, status, latency_ms, error, tool_calls_json,
            branch_id, counterfactual_of, modified_params, created_at
     FROM agent_runs WHERE project_id = ? AND id = ?`,
  )
    .bind(projectId, runId)
    .first();
}

/** @param {*} env @param {string} projectId @param {string} originalRunId */
export async function listCounterfactualRuns(env, projectId, originalRunId) {
  const rows = await env.DB.prepare(
    `SELECT id, agent_id, room_id, status, latency_ms, error, tool_calls_json,
            branch_id, counterfactual_of, modified_params, created_at
     FROM agent_runs
     WHERE project_id = ? AND counterfactual_of = ?
     ORDER BY created_at ASC`,
  )
    .bind(projectId, originalRunId)
    .all();
  return (rows.results || []).map(mapAgentRunRow);
}

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   roomId: string,
 *   userId: string,
 *   originalRunId: string,
 *   toolCallId: string,
 *   modifiedParams?: Record<string, unknown>,
 *   fromMessageId?: number | null,
 *   dryRun?: boolean,
 *   agentIds?: string[],
 *   isAdmin?: boolean,
 *   traceId?: string,
 * }} input
 */
export async function replayCounterfactualToolCall(env, input) {
  const original = await getAgentRunRecord(env, input.projectId, input.originalRunId);
  if (!original) {
    return { ok: false, reason: "original_run_not_found" };
  }
  if (String(original.room_id || "") !== input.roomId) {
    return { ok: false, reason: "room_mismatch" };
  }
  if (original.counterfactual_of) {
    return { ok: false, reason: "nested_counterfactual_not_allowed" };
  }

  const toolCalls = parseToolCallsJson(original.tool_calls_json);
  const toolCall = toolCalls.find((tc) => String(tc.id) === String(input.toolCallId));
  if (!toolCall) {
    return { ok: false, reason: "tool_call_not_found" };
  }

  let baseArgs = {};
  try {
    baseArgs = JSON.parse(String(toolCall.arguments || "{}"));
  } catch {
    baseArgs = {};
  }

  const modifiedParams =
    input.modifiedParams && typeof input.modifiedParams === "object" ? input.modifiedParams : {};
  const mergedArgs = mergeToolArguments(baseArgs, modifiedParams);
  const sideEffect = isSideEffectTool(toolCall.name);
  const dryRun = sideEffect ? true : input.dryRun === true;

  let branchDeletedIds = [];
  if (input.fromMessageId) {
    const branchResult = await branchRoomFromMessage(
      env,
      input.projectId,
      input.roomId,
      Number(input.fromMessageId),
      input.userId,
      input.agentIds || [String(original.agent_id)],
      { isAdmin: input.isAdmin },
    );
    if (!branchResult.ok) {
      return { ok: false, reason: branchResult.reason || "branch_failed", branch: branchResult };
    }
    branchDeletedIds = branchResult.deletedIds || [];
  }

  const agentRow = await env.DB.prepare(
    "SELECT id, tool_execute_url FROM bots WHERE id = ? AND project_id = ?",
  )
    .bind(original.agent_id, input.projectId)
    .first();

  if (!agentRow?.tool_execute_url) {
    return { ok: false, reason: "agent_tool_execute_url_missing" };
  }

  const branchId = crypto.randomUUID();
  const newRunId = crypto.randomUUID();
  const traceId = input.traceId || crypto.randomUUID();
  const modifiedToolCall = {
    id: toolCall.id,
    name: toolCall.name,
    arguments: JSON.stringify(mergedArgs),
  };

  const started = Date.now();
  const toolResult = await executeToolCall(
    env,
    agentRow.tool_execute_url,
    modifiedToolCall,
    input.projectId,
    newRunId,
    traceId,
    { dryRun },
  );
  const latencyMs = Date.now() - started;

  const resultPreview = toolResult.success
    ? truncateForStorage(JSON.stringify(toolResult.result ?? {}), 500)
    : String(toolResult.error || "failed");

  const storedToolCalls = [
    {
      ...modifiedToolCall,
      success: toolResult.success,
      resultPreview,
      counterfactual: true,
      dryRun,
    },
  ];

  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO agent_runs
     (id, project_id, agent_id, room_id, status, latency_ms, input_tokens, output_tokens,
      estimated_cost, error, tool_calls_json, context_fetched, iterations,
      branch_id, counterfactual_of, modified_params, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, 0, 1, ?, ?, ?, ?)`,
  )
    .bind(
      newRunId,
      input.projectId,
      original.agent_id,
      input.roomId,
      toolResult.success ? "completed" : "failed",
      latencyMs,
      toolResult.success ? null : String(toolResult.error || "tool_failed"),
      JSON.stringify(storedToolCalls),
      branchId,
      input.originalRunId,
      JSON.stringify({ toolCallId: input.toolCallId, params: modifiedParams, dryRun }),
      now,
    )
    .run();

  return {
    ok: true,
    branchId,
    runId: newRunId,
    originalRunId: input.originalRunId,
    toolCallId: input.toolCallId,
    dryRun,
    sideEffect,
    costWarning: sideEffect ? "Side-effect tool replayed in dry-run mode only." : null,
    toolResult,
    branchDeletedIds,
    run: mapAgentRunRow({
      id: newRunId,
      agent_id: original.agent_id,
      room_id: input.roomId,
      status: toolResult.success ? "completed" : "failed",
      latency_ms: latencyMs,
      error: toolResult.success ? null : String(toolResult.error || "tool_failed"),
      tool_calls_json: JSON.stringify(storedToolCalls),
      branch_id: branchId,
      counterfactual_of: input.originalRunId,
      modified_params: JSON.stringify({ toolCallId: input.toolCallId, params: modifiedParams, dryRun }),
      created_at: now,
    }),
    original: mapAgentRunRow(original),
  };
}
