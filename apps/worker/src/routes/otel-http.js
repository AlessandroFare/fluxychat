import { resolveAdminContext } from "../lib/admin-route-context.js";
import {
  listExportConfigs,
  getExportConfig,
  createExportConfig,
  updateExportConfig,
  deleteExportConfig,
  getExportQueueStats,
  flushExportQueue,
  exportTracesFromAudit,
  exportMetrics,
  buildOtelTracePayload,
  buildOtelMetricPayload,
  buildLangfuseOtelExportInput,
  createLangfuseOtelExportConfig,
} from "../lib/otel-export.js";

export async function dispatchOtelRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/otel/")) return null;

  const ctx = await resolveAdminContext(request, h);
  if (ctx.response) return ctx.response;
  const { env, json: respond, projectId } = ctx;

  async function configForProject(id) {
    const config = await getExportConfig(env, id);
    if (!config || config.project_id !== projectId) {
      return { error: respond({ error: "not_found" }, h, 404) };
    }
    return { config };
  }

  if (request.method === "GET" && path === "/otel/configs") {
    const configs = await listExportConfigs(env, projectId);
    return respond({ configs }, h);
  }

  if (request.method === "GET" && path.startsWith("/otel/configs/")) {
    const id = path.split("/").pop();
    const gate = await configForProject(id);
    if (gate.error) return gate.error;
    return respond({ config: gate.config }, h);
  }

  if (request.method === "POST" && path === "/otel/configs/langfuse") {
    const body = await request.json().catch(() => ({}));
    const result = await createLangfuseOtelExportConfig(env, {
      projectId,
      host: body.host,
      publicKey: body.publicKey,
      secretKey: body.secretKey,
      name: body.name,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "POST" && path === "/otel/configs") {
    const body = await request.json();
    const result = await createExportConfig(env, {
      projectId,
      name: body.name,
      endpointUrl: body.endpointUrl,
      exportType: body.exportType,
      authHeader: body.authHeader,
      headersJson: body.headersJson,
      batchSize: body.batchSize,
      flushIntervalSeconds: body.flushIntervalSeconds,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "PATCH" && path.startsWith("/otel/configs/")) {
    const id = path.split("/").pop();
    const gate = await configForProject(id);
    if (gate.error) return gate.error;
    const body = await request.json();
    const result = await updateExportConfig(env, { id, ...body });
    if (result.error === "not_found") return respond(result, h, 404);
    return respond(result, h);
  }

  if (request.method === "DELETE" && path.startsWith("/otel/configs/")) {
    const id = path.split("/").pop();
    const gate = await configForProject(id);
    if (gate.error) return gate.error;
    const result = await deleteExportConfig(env, id);
    if (result.error === "not_found") return respond(result, h, 404);
    return respond(result, h);
  }

  if (request.method === "GET" && path === "/otel/queue/stats") {
    const stats = await getExportQueueStats(env, projectId);
    return respond({ stats }, h);
  }

  if (request.method === "POST" && path === "/otel/flush") {
    const body = await request.json().catch(() => ({}));
    const results = [];
    const configs = await listExportConfigs(env, projectId);
    for (const cfg of configs.filter((c) => c.enabled)) {
      if (body.configId && body.configId !== cfg.id) continue;
      const result = await flushExportQueue(env, { configId: cfg.id, maxBatch: body.maxBatch || 100 });
      results.push({ configId: cfg.id, ...result });
    }
    return respond({ results }, h);
  }

  if (request.method === "POST" && path === "/otel/export/traces") {
    const body = await request.json().catch(() => ({}));
    const spans = await exportTracesFromAudit(env, {
      projectId,
      since: body.since,
      until: body.until,
      limit: body.limit || 100,
    });
    const payload = buildOtelTracePayload(spans);
    return respond({ spans: spans.length, payload }, h);
  }

  if (request.method === "POST" && path === "/otel/export/metrics") {
    const body = await request.json().catch(() => ({}));
    const metrics = await exportMetrics(env, {
      projectId,
      since: body.since,
      until: body.until,
      limit: body.limit || 200,
    });
    const payload = buildOtelMetricPayload(metrics);
    return respond({ metrics: metrics.length, payload }, h);
  }

  return null;
}
