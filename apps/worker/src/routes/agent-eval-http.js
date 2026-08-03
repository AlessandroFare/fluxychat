import { pickRouteDeps } from "./route-http-deps.js";
import {
  createAgentEvalDataset,
  deleteAgentEvalDataset,
  getAgentEvalDataset,
  listAgentEvalDatasets,
  listAgentEvalRuns,
  runAgentEvalDataset,
  agentRunsToOtelSpans,
  flushAgentEvalOtelQueue,
  captureFailedAgentRunAsEvalCase,
} from "../lib/agent-eval.js";
import { buildOtelTracePayload, buildTraceSpan } from "../lib/otel-export.js";

export async function dispatchAgentEvalRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/admin/agent-eval")) return null;

  const {
    env,
    json,
    corsHeaders,
    verifyJwtAndGetContext,
    hasAnyRole,
    logError,
    requestLogCtx,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "verifyJwtAndGetContext",
    "hasAnyRole",
    "logError",
    "requestLogCtx",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  if (!hasAnyRole(auth.roles, ["owner", "admin", "moderator"])) {
    return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
  }

  try {
    if (request.method === "GET" && path === "/admin/agent-eval/datasets") {
      const datasets = await listAgentEvalDatasets(env, { projectId: auth.projectId });
      return json({ ok: true, datasets }, { headers: corsHeaders });
    }

    if (request.method === "POST" && path === "/admin/agent-eval/datasets") {
      const body = await request.json().catch(() => ({}));
      const result = await createAgentEvalDataset(env, {
        projectId: auth.projectId,
        name: body.name,
        description: body.description,
        cases: body.cases,
      });
      if (!result.ok) return json(result, { status: 400, headers: corsHeaders });
      return json(result, { status: 201, headers: corsHeaders });
    }

    const datasetMatch = path.match(/^\/admin\/agent-eval\/datasets\/([^/]+)$/);
    if (datasetMatch && request.method === "GET") {
      const dataset = await getAgentEvalDataset(env, {
        projectId: auth.projectId,
        datasetId: datasetMatch[1],
      });
      if (!dataset) return json({ error: "not_found" }, { status: 404, headers: corsHeaders });
      return json({ ok: true, dataset }, { headers: corsHeaders });
    }

    if (datasetMatch && request.method === "DELETE") {
      const result = await deleteAgentEvalDataset(env, {
        projectId: auth.projectId,
        datasetId: datasetMatch[1],
      });
      return json(result, { headers: corsHeaders });
    }

    const runMatch = path.match(/^\/admin\/agent-eval\/datasets\/([^/]+)\/run$/);
    if (runMatch && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const result = await runAgentEvalDataset(env, {
        projectId: auth.projectId,
        datasetId: runMatch[1],
        agentId: body.agentId,
        limit: body.limit,
      });
      if (!result.ok) return json(result, { status: 404, headers: corsHeaders });
      return json(result, { headers: corsHeaders });
    }

    if (request.method === "GET" && path === "/admin/agent-eval/runs") {
      const datasetId = url.searchParams.get("datasetId") ?? undefined;
      const runs = await listAgentEvalRuns(env, {
        projectId: auth.projectId,
        datasetId,
      });
      return json({ ok: true, runs }, { headers: corsHeaders });
    }

    const fromRunMatch = path.match(/^\/admin\/agent-eval\/from-run\/([^/]+)$/);
    if (fromRunMatch && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const result = await captureFailedAgentRunAsEvalCase(env, {
        projectId: auth.projectId,
        runId: fromRunMatch[1],
        datasetId: body.datasetId,
      });
      if (!result.ok) {
        const status =
          result.error === "run_not_found" ? 404 : result.error === "run_not_failed" ? 422 : 400;
        return json(result, { status, headers: corsHeaders });
      }
      return json(result, { status: result.duplicate ? 200 : 201, headers: corsHeaders });
    }

    if (request.method === "POST" && path === "/admin/agent-eval/export-otel") {
      const body = await request.json().catch(() => ({}));
      const limit = Math.min(Number(body.limit ?? 100), 500);
      const rows = await env.DB.prepare(
        `SELECT id, agent_id, room_id, status, latency_ms, error, created_at
         FROM agent_runs WHERE project_id = ? ORDER BY created_at DESC LIMIT ?`,
      )
        .bind(auth.projectId, limit)
        .all();
      const spanInputs = agentRunsToOtelSpans(rows.results || []);
      const spans = spanInputs.map((s) =>
        buildTraceSpan({
          traceId: s.traceId,
          spanId: s.spanId,
          name: s.name,
          startTime: s.startTime,
          attributes: s.attributes,
          status: s.attributes["fluxychat.status"] === "failed" ? "ERROR" : "OK",
        }),
      );
      const payload = buildOtelTracePayload(spans);
      return json({ ok: true, spanCount: spans.length, payload }, { headers: corsHeaders });
    }

    if (request.method === "POST" && path === "/admin/agent-eval/flush-otel") {
      const body = await request.json().catch(() => ({}));
      const result = await flushAgentEvalOtelQueue(env, {
        projectId: auth.projectId,
        maxBatch: body.maxBatch,
      });
      return json({ ok: true, ...result }, { headers: corsHeaders });
    }

    return null;
  } catch (err) {
    logError("agent_eval.unhandled", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
