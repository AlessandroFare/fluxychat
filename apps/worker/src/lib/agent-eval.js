/**
 * Agent eval datasets — sample against recent agent_runs (roadmap #9).
 */

import { buildOtelTracePayload, buildTraceSpan, enqueueExport } from "./otel-export.js";

function generateId(prefix) {
  return `${prefix}_${Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

function parseCases(raw) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseToolCalls(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toolNamesFromRun(row) {
  return parseToolCalls(row.tool_calls_json)
    .map((t) => String(t.name ?? t.toolName ?? t.tool ?? "").trim())
    .filter(Boolean);
}

/**
 * Score one eval case against a matched agent_run row.
 * @param {Record<string, unknown> | null | undefined} match
 * @param {Record<string, unknown>} evalCase
 * @param {string} [outputSnippet] recent room message text after the run
 */
export function scoreEvalCaseAgainstRun(match, evalCase, outputSnippet = "") {
  const expectStatus = evalCase.expectedStatus ?? "completed";
  const maxLatencyMs = Number(evalCase.maxLatencyMs ?? 30000);
  const tag = evalCase.tag ?? evalCase.name ?? "case";

  if (!match) {
    return { tag, passed: false, reason: "no_matching_run", runId: null, status: null, latencyMs: null };
  }

  let passed = true;
  let reason = "ok";

  if (match.status !== expectStatus) {
    passed = false;
    reason = `status_${match.status}_expected_${expectStatus}`;
  } else if (match.latency_ms != null && match.latency_ms > maxLatencyMs) {
    passed = false;
    reason = `latency_${match.latency_ms}_max_${maxLatencyMs}`;
  } else if (evalCase.mustNotError && match.error) {
    passed = false;
    reason = "unexpected_error";
  } else {
    const tools = toolNamesFromRun(match);
    if (evalCase.minToolCalls != null && tools.length < Number(evalCase.minToolCalls)) {
      passed = false;
      reason = `tool_count_${tools.length}_min_${evalCase.minToolCalls}`;
    } else if (evalCase.maxToolCalls != null && tools.length > Number(evalCase.maxToolCalls)) {
      passed = false;
      reason = `tool_count_${tools.length}_max_${evalCase.maxToolCalls}`;
    } else if (Array.isArray(evalCase.requiredTools) && evalCase.requiredTools.length) {
      for (const required of evalCase.requiredTools) {
        const needle = String(required).toLowerCase();
        if (!tools.some((name) => name.toLowerCase() === needle || name.toLowerCase().includes(needle))) {
          passed = false;
          reason = `missing_tool_${required}`;
          break;
        }
      }
    }
  }

  if (passed && evalCase.expectedOutputContains) {
    const needle = String(evalCase.expectedOutputContains).toLowerCase();
    if (!String(outputSnippet).toLowerCase().includes(needle)) {
      passed = false;
      reason = "output_missing_expected";
    }
  }
  if (passed && evalCase.forbiddenOutputContains) {
    const needle = String(evalCase.forbiddenOutputContains).toLowerCase();
    if (String(outputSnippet).toLowerCase().includes(needle)) {
      passed = false;
      reason = "output_contains_forbidden";
    }
  }

  return {
    tag,
    passed,
    reason,
    runId: match.id ?? null,
    status: match.status ?? null,
    latencyMs: match.latency_ms ?? null,
    outputChecked: Boolean(outputSnippet),
  };
}

export async function fetchAgentRunOutputSnippet(env, roomId, runCreatedAt) {
  if (!roomId || !runCreatedAt) return "";
  const rows = await env.DB.prepare(
    `SELECT content FROM messages WHERE room_id = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 5`,
  )
    .bind(roomId, runCreatedAt)
    .all();
  return (rows.results || []).map((row) => String(row.content ?? "")).join("\n");
}

function mapDatasetRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    cases: parseCases(row.cases_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAgentEvalDatasets(env, { projectId }) {
  const rows = await env.DB.prepare(
    `SELECT * FROM agent_eval_datasets WHERE project_id = ? ORDER BY updated_at DESC`,
  )
    .bind(projectId)
    .all();
  return (rows.results || []).map(mapDatasetRow);
}

export async function getAgentEvalDataset(env, { projectId, datasetId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM agent_eval_datasets WHERE project_id = ? AND id = ?`,
  )
    .bind(projectId, datasetId)
    .first();
  return row ? mapDatasetRow(row) : null;
}

export async function createAgentEvalDataset(env, input) {
  const { projectId, name, description, cases } = input;
  if (!projectId || !name?.trim()) return { ok: false, error: "missing_fields" };
  const caseList = Array.isArray(cases) ? cases : [];
  if (!caseList.length) return { ok: false, error: "cases_required" };

  const id = generateId("aed");
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO agent_eval_datasets (id, project_id, name, description, cases_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, projectId, name.trim(), description ?? null, JSON.stringify(caseList), now, now)
    .run();

  return { ok: true, dataset: await getAgentEvalDataset(env, { projectId, datasetId: id }) };
}

export async function deleteAgentEvalDataset(env, { projectId, datasetId }) {
  await env.DB.prepare(`DELETE FROM agent_eval_runs WHERE project_id = ? AND dataset_id = ?`)
    .bind(projectId, datasetId)
    .run();
  const result = await env.DB.prepare(
    `DELETE FROM agent_eval_datasets WHERE project_id = ? AND id = ?`,
  )
    .bind(projectId, datasetId)
    .run();
  return { ok: true, deleted: result.meta?.changes || 0 };
}

const PROD_FAILURES_DATASET_NAME = "Prod failures (auto)";

export async function getOrCreateProdFailuresDataset(env, projectId) {
  const existing = await env.DB.prepare(
    `SELECT * FROM agent_eval_datasets WHERE project_id = ? AND name = ? LIMIT 1`,
  )
    .bind(projectId, PROD_FAILURES_DATASET_NAME)
    .first();
  if (existing) return mapDatasetRow(existing);

  const created = await createAgentEvalDataset(env, {
    projectId,
    name: PROD_FAILURES_DATASET_NAME,
    description: "Auto-captured from failed production agent_runs (#40)",
    cases: [{ tag: "__seed__", name: "seed", expectedStatus: "completed" }],
  });
  if (!created.ok) return null;
  return created.dataset;
}

export async function appendEvalCaseToDataset(env, { projectId, datasetId, evalCase }) {
  const dataset = await getAgentEvalDataset(env, { projectId, datasetId });
  if (!dataset) return { ok: false, error: "dataset_not_found" };

  let cases = [...dataset.cases].filter((c) => c.tag !== "__seed__");
  if (evalCase.sourceRunId && cases.some((c) => c.sourceRunId === evalCase.sourceRunId)) {
    return { ok: true, duplicate: true, datasetId, caseCount: cases.length };
  }

  cases.push(evalCase);
  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE agent_eval_datasets SET cases_json = ?, updated_at = ? WHERE project_id = ? AND id = ?`,
  )
    .bind(JSON.stringify(cases), now, projectId, datasetId)
    .run();

  return { ok: true, datasetId, caseCount: cases.length, evalCase };
}

/**
 * Capture a failed prod agent_run as a regression eval case (#40).
 * @param {*} env
 * @param {{ projectId: string, runId: string, datasetId?: string }} input
 */
export async function captureFailedAgentRunAsEvalCase(env, input) {
  const row = await env.DB.prepare(
    `SELECT id, agent_id, room_id, status, latency_ms, error, tool_calls_json, created_at
     FROM agent_runs WHERE project_id = ? AND id = ?`,
  )
    .bind(input.projectId, input.runId)
    .first();
  if (!row) return { ok: false, error: "run_not_found" };
  if (row.status !== "failed") return { ok: false, error: "run_not_failed" };

  let datasetId = input.datasetId;
  if (!datasetId) {
    const dataset = await getOrCreateProdFailuresDataset(env, input.projectId);
    if (!dataset) return { ok: false, error: "dataset_create_failed" };
    datasetId = dataset.id;
  }

  const tools = toolNamesFromRun(row);
  const outputSnippet = row.room_id
    ? await fetchAgentRunOutputSnippet(env, row.room_id, row.created_at)
    : "";

  const evalCase = {
    tag: `prod-fail-${String(row.id).slice(0, 12)}`,
    name: `Failed run ${row.id}`,
    sourceRunId: row.id,
    expectedStatus: "completed",
    maxLatencyMs: Math.max(30000, Math.ceil((Number(row.latency_ms) || 0) * 1.5)),
    agentId: row.agent_id,
    roomId: row.room_id ?? undefined,
    mustNotError: true,
    ...(tools.length ? { requiredTools: tools.slice(0, 5) } : {}),
    capturedError: row.error ? String(row.error).slice(0, 500) : null,
    capturedOutputSnippet: outputSnippet.slice(0, 500),
    capturedAt: new Date().toISOString(),
  };

  const appended = await appendEvalCaseToDataset(env, {
    projectId: input.projectId,
    datasetId,
    evalCase,
  });
  return { ...appended, evalCase, sourceRunId: row.id };
}

/**
 * When AGENT_EVAL_AUTO_CAPTURE_FAILED=true, append failed prod runs to the auto dataset.
 */
export async function maybeAutoCaptureFailedAgentRun(env, { projectId, runId }) {
  if (env.AGENT_EVAL_AUTO_CAPTURE_FAILED !== "true") {
    return { ok: false, skipped: true, reason: "disabled" };
  }
  try {
    return await captureFailedAgentRunAsEvalCase(env, { projectId, runId });
  } catch {
    return { ok: false, error: "capture_failed" };
  }
}

/**
 * Score dataset cases against recent agent_runs (latency + status heuristics).
 */
export async function runAgentEvalDataset(env, { projectId, datasetId, agentId, limit = 50 }) {
  const dataset = await getAgentEvalDataset(env, { projectId, datasetId });
  if (!dataset) return { ok: false, error: "dataset_not_found" };

  const runs = await env.DB.prepare(
    agentId
      ? `SELECT id, agent_id, room_id, status, latency_ms, error, tool_calls_json, created_at
         FROM agent_runs WHERE project_id = ? AND agent_id = ? ORDER BY created_at DESC LIMIT ?`
      : `SELECT id, agent_id, room_id, status, latency_ms, error, tool_calls_json, created_at
         FROM agent_runs WHERE project_id = ? ORDER BY created_at DESC LIMIT ?`,
  )
    .bind(...(agentId ? [projectId, agentId, limit] : [projectId, limit]))
    .all();

  const runRows = runs.results || [];
  const results = [];
  let passCount = 0;
  let failCount = 0;

  for (const evalCase of dataset.cases) {
    if (evalCase.tag === "__seed__") continue;
    const match = runRows.find((r) => {
      if (evalCase.agentId && r.agent_id !== evalCase.agentId) return false;
      if (evalCase.roomId && r.room_id !== evalCase.roomId) return false;
      return true;
    });

    const outputSnippet = match?.room_id
      ? await fetchAgentRunOutputSnippet(env, match.room_id, match.created_at)
      : "";
    const result = scoreEvalCaseAgainstRun(match, evalCase, outputSnippet);
    if (result.passed) passCount++;
    else failCount++;
    results.push(result);
  }

  const runId = generateId("aer");
  const now = new Date().toISOString();
  const status = failCount === 0 ? "passed" : passCount === 0 ? "failed" : "partial";

  await env.DB.prepare(
    `INSERT INTO agent_eval_runs (id, project_id, dataset_id, status, pass_count, fail_count, results_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(runId, projectId, datasetId, status, passCount, failCount, JSON.stringify(results), now)
    .run();

  if (env.OTEL_AGENT_EVAL_AUTO !== "false") {
    await pushAgentEvalSpansToOtel(env, { projectId, evalRunId: runId, results }).catch(() => {});
  }

  return {
    ok: true,
    evalRunId: runId,
    status,
    passCount,
    failCount,
    results,
    sampledRuns: runRows.length,
  };
}

export async function listAgentEvalRuns(env, { projectId, datasetId, limit = 20 }) {
  const sql = datasetId
    ? `SELECT * FROM agent_eval_runs WHERE project_id = ? AND dataset_id = ? ORDER BY created_at DESC LIMIT ?`
    : `SELECT * FROM agent_eval_runs WHERE project_id = ? ORDER BY created_at DESC LIMIT ?`;
  const binds = datasetId ? [projectId, datasetId, limit] : [projectId, limit];
  const rows = await env.DB.prepare(sql).bind(...binds).all();
  return (rows.results || []).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    datasetId: row.dataset_id,
    status: row.status,
    passCount: row.pass_count,
    failCount: row.fail_count,
    results: row.results_json ? JSON.parse(row.results_json) : [],
    createdAt: row.created_at,
  }));
}

export function agentRunsToOtelSpans(runs) {
  return runs.map((row) => ({
    traceId: row.id.replace(/-/g, "").slice(0, 32),
    spanId: row.id.replace(/-/g, "").slice(0, 16),
    name: `agent.run.${row.status}`,
    attributes: {
      "fluxychat.agent_id": row.agent_id,
      "fluxychat.room_id": row.room_id ?? "",
      "fluxychat.latency_ms": String(row.latency_ms ?? 0),
      "fluxychat.status": row.status,
    },
    startTime: row.created_at,
  }));
}

/**
 * Queue eval result spans to configured OTel export configs.
 */
export async function pushAgentEvalSpansToOtel(env, { projectId, evalRunId, results }) {
  const configs = await env.DB.prepare(
    `SELECT id FROM otel_export_config WHERE project_id = ? AND enabled = 1 AND export_type IN ('traces', 'all')`,
  )
    .bind(projectId)
    .all();

  if (!configs.results?.length || !results?.length) {
    return { queued: 0 };
  }

  const traceId = String(evalRunId).replace(/-/g, "").slice(0, 32);
  const spans = results.map((result, index) =>
    buildTraceSpan({
      traceId,
      spanId: `${traceId.slice(0, 8)}${String(index).padStart(8, "0")}`.slice(0, 16),
      name: `agent.eval.${result.tag}`,
      attributes: {
        "fluxychat.eval.passed": String(result.passed),
        "fluxychat.eval.reason": result.reason,
        "fluxychat.eval.run_id": result.runId ?? "",
        "fluxychat.eval.status": result.status ?? "",
      },
      status: result.passed ? "OK" : "ERROR",
    }),
  );

  const payload = buildOtelTracePayload(spans);
  for (const cfg of configs.results) {
    await enqueueExport(env, {
      configId: cfg.id,
      projectId,
      payloadType: "trace",
      payload,
    });
  }

  return { queued: configs.results.length, spanCount: spans.length };
}

export async function flushAgentEvalOtelQueue(env, { projectId, maxBatch = 100 } = {}) {
  const { flushExportQueue } = await import("./otel-export.js");
  const configs = await env.DB.prepare(
    `SELECT id FROM otel_export_config WHERE project_id = ? AND enabled = 1`,
  )
    .bind(projectId)
    .all();

  let exported = 0;
  let failed = 0;
  for (const cfg of configs.results || []) {
    const result = await flushExportQueue(env, { configId: cfg.id, maxBatch });
    exported += result.exported || 0;
    failed += result.failed || 0;
  }
  return { exported, failed, configs: (configs.results || []).length };
}
