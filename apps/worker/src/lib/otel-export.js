import { logInfo, logError } from "./worker-log.js";

const OTEL_VERSION = "1.2.0";
const RESOURCE_ATTRIBUTES = {
  "service.name": "fluxychat",
  "service.version": "0.2.0",
  "service.environment": "production",
};

function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function nowNano() {
  return BigInt(Date.now()) * 1000000n;
}

export function buildTraceSpan({ traceId, spanId, parentSpanId, name, startTime, endTime, attributes = {}, status = "OK" }) {
  return {
    traceId: traceId || generateId(),
    spanId: spanId || generateId(),
    parentSpanId: parentSpanId || undefined,
    name: name || "unknown",
    kind: 1,
    startTimeUnixNano: String(startTime || nowNano()),
    endTimeUnixNano: String(endTime || nowNano()),
    status: { code: status },
    attributes: Object.entries(attributes).map(([key, value]) => ({
      key,
      value: { stringValue: String(value) },
    })),
    resource: {
      attributes: Object.entries(RESOURCE_ATTRIBUTES).map(([key, value]) => ({
        key,
        value: { stringValue: String(value) },
      })),
    },
  };
}

export function buildOtelTracePayload(spans) {
  return {
    resourceSpans: [
      {
        resource: {
          attributes: Object.entries(RESOURCE_ATTRIBUTES).map(([key, value]) => ({
            key,
            value: { stringValue: String(value) },
          })),
        },
        scopeSpans: [
          {
            scope: { name: "fluxychat-worker", version: OTEL_VERSION },
            spans: spans,
          },
        ],
      },
    ],
  };
}

export function buildOtelMetricPayload(metrics) {
  return {
    resourceMetrics: [
      {
        resource: {
          attributes: Object.entries(RESOURCE_ATTRIBUTES).map(([key, value]) => ({
            key,
            value: { stringValue: String(value) },
          })),
        },
        scopeMetrics: [
          {
            scope: { name: "fluxychat-worker", version: OTEL_VERSION },
            metrics: metrics,
          },
        ],
      },
    ],
  };
}

export function buildOtelLogPayload(logs) {
  return {
    resourceLogs: [
      {
        resource: {
          attributes: Object.entries(RESOURCE_ATTRIBUTES).map(([key, value]) => ({
            key,
            value: { stringValue: String(value) },
          })),
        },
        scopeLogs: [
          {
            scope: { name: "fluxychat-worker", version: OTEL_VERSION },
            logRecords: logs,
          },
        ],
      },
    ],
  };
}

export function traceToSpan(traceRow) {
  const attrs = {};
  if (traceRow.project_id) attrs["fluxychat.project_id"] = traceRow.project_id;
  if (traceRow.action) attrs["fluxychat.action"] = traceRow.action;
  if (traceRow.target_type) attrs["fluxychat.target_type"] = traceRow.target_type;
  if (traceRow.target_id) attrs["fluxychat.target_id"] = traceRow.target_id;
  if (traceRow.actor_user_id) attrs["flxuchat.actor_user_id"] = traceRow.actor_user_id;

  return buildTraceSpan({
    traceId: traceRow.trace_id,
    name: traceRow.action || "unknown",
    startTime: traceRow.created_at,
    attributes: attrs,
  });
}

export function metricToOtel(metricRow) {
  const metricName = `fluxychat.${metricRow.metric_name}`;
  const startTime = metricRow.bucket_minute;

  return {
    name: metricName,
    description: `FluxyChat metric: ${metricRow.metric_name}`,
    gauge: {
      dataPoints: [
        {
          asInt: metricRow.metric_value,
          startTimeUnixNano: String(BigInt(new Date(startTime).getTime()) * 1000000n),
          timeUnixNano: String(nowNano()),
          attributes: [
            { key: "project_id", value: { stringValue: metricRow.project_id } },
          ],
        },
      ],
    },
  };
}

export function logEntryToOtel(logEntry) {
  const severityMap = { info: 9, error: 17, warn: 13, debug: 5 };
  return {
    timeUnixNano: String(BigInt(new Date(logEntry.ts).getTime()) * 1000000n),
    severityNumber: severityMap[logEntry.level] || 9,
    severityText: (logEntry.level || "info").toUpperCase(),
    body: { stringValue: logEntry.event || "unknown" },
    attributes: Object.entries(logEntry)
      .filter(([k]) => !["level", "event", "ts"].includes(k))
      .map(([key, value]) => ({
        key,
        value: { stringValue: typeof value === "string" ? value : JSON.stringify(value) },
      })),
  };
}

export async function enqueueExport(env, { configId, projectId, payloadType, payload }) {
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO otel_export_queue (config_id, project_id, payload_type, payload_json, status, attempts, created_at) VALUES (?, ?, ?, ?, 'pending', 0, ?)"
  )
    .bind(configId, projectId, payloadType, JSON.stringify(payload), now)
    .run();
}

export async function flushExportQueue(env, { configId, maxBatch = 100 } = {}) {
  const config = await env.DB.prepare(
    "SELECT * FROM otel_export_config WHERE id = ? AND enabled = 1"
  )
    .bind(configId)
    .first();

  if (!config) return { exported: 0, failed: 0 };

  const rows = await env.DB.prepare(
    "SELECT * FROM otel_export_queue WHERE config_id = ? AND status = 'pending' ORDER BY created_at ASC LIMIT ?"
  )
    .bind(configId, maxBatch)
    .all();

  if (!rows.results?.length) return { exported: 0, failed: 0 };

  const headers = { "Content-Type": "application/json" };
  if (config.auth_header) headers["Authorization"] = config.auth_header;
  if (config.headers_json) {
    try {
      Object.assign(headers, JSON.parse(config.headers_json));
    } catch {}
  }

  let exported = 0;
  let failed = 0;
  const now = new Date().toISOString();

  for (const row of rows.results) {
    try {
      const endpoint = config.export_type === "traces"
        ? `${config.endpoint_url}/v1/traces`
        : config.export_type === "metrics"
          ? `${config.endpoint_url}/v1/metrics`
          : config.export_type === "logs"
            ? `${config.endpoint_url}/v1/logs`
            : config.endpoint_url;

      const resp = await fetch(endpoint, {
        method: "POST",
        headers,
        body: row.payload_json,
      });

      if (resp.ok) {
        await env.DB.prepare(
          "UPDATE otel_export_queue SET status = 'sent', sent_at = ?, attempts = attempts + 1 WHERE id = ?"
        )
          .bind(now, row.id)
          .run();
        exported++;
      } else {
        throw new Error(`HTTP ${resp.status}`);
      }
    } catch (err) {
      failed++;
      await env.DB.prepare(
        "UPDATE otel_export_queue SET status = 'failed', last_error = ?, attempts = attempts + 1 WHERE id = ?"
      )
        .bind(err.message, row.id)
        .run();
    }
  }

  logInfo("otel.flush_completed", { configId, exported, failed });
  return { exported, failed };
}

export async function listExportConfigs(env, projectId) {
  const rows = await env.DB.prepare(
    "SELECT * FROM otel_export_config WHERE project_id = ? ORDER BY created_at DESC"
  )
    .bind(projectId)
    .all();
  return rows.results || [];
}

export async function getExportConfig(env, id) {
  return await env.DB.prepare(
    "SELECT * FROM otel_export_config WHERE id = ?"
  )
    .bind(id)
    .first();
}

export async function createExportConfig(env, { projectId, name, endpointUrl, exportType, authHeader, headersJson, batchSize, flushIntervalSeconds }) {
  if (!name || !endpointUrl || !exportType) {
    return { error: "name, endpointUrl, and exportType are required" };
  }

  const validTypes = ["traces", "metrics", "logs", "all"];
  if (!validTypes.includes(exportType)) {
    return { error: `exportType must be one of: ${validTypes.join(", ")}` };
  }

  const id = `otel_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();

  await env.DB.prepare(
    "INSERT INTO otel_export_config (id, project_id, name, endpoint_url, export_type, auth_header, headers_json, batch_size, flush_interval_seconds, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)"
  )
    .bind(
      id, projectId, name, endpointUrl, exportType,
      authHeader || null, headersJson || null,
      batchSize || 100, flushIntervalSeconds || 60,
      now, now
    )
    .run();

  return { id, created: true };
}

export async function updateExportConfig(env, { id, name, endpointUrl, exportType, authHeader, headersJson, batchSize, flushIntervalSeconds, enabled }) {
  const existing = await getExportConfig(env, id);
  if (!existing) return { error: "not_found" };

  const now = new Date().toISOString();
  await env.DB.prepare(
    "UPDATE otel_export_config SET name = ?, endpoint_url = ?, export_type = ?, auth_header = ?, headers_json = ?, batch_size = ?, flush_interval_seconds = ?, enabled = ?, updated_at = ? WHERE id = ?"
  )
    .bind(
      name || existing.name,
      endpointUrl || existing.endpoint_url,
      exportType || existing.export_type,
      authHeader !== undefined ? authHeader : existing.auth_header,
      headersJson !== undefined ? headersJson : existing.headers_json,
      batchSize || existing.batch_size,
      flushIntervalSeconds || existing.flush_interval_seconds,
      enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
      now, id
    )
    .run();

  return { updated: true };
}

export async function deleteExportConfig(env, id) {
  const existing = await getExportConfig(env, id);
  if (!existing) return { error: "not_found" };

  await env.DB.prepare("DELETE FROM otel_export_config WHERE id = ?").bind(id).run();
  await env.DB.prepare("DELETE FROM otel_export_queue WHERE config_id = ?").bind(id).run();

  return { deleted: true };
}

export async function getExportQueueStats(env, projectId) {
  const rows = await env.DB.prepare(
    "SELECT status, COUNT(*) as count FROM otel_export_queue WHERE project_id = ? GROUP BY status"
  )
    .bind(projectId)
    .all();

  const stats = { pending: 0, sent: 0, failed: 0 };
  for (const row of rows.results || []) {
    stats[row.status] = row.count;
  }
  return stats;
}

export async function exportTracesFromAudit(env, { projectId, since, until, limit = 100 }) {
  const params = [projectId];
  let query = "SELECT * FROM operational_audit_events WHERE project_id = ?";
  if (since) { query += " AND created_at >= ?"; params.push(since); }
  if (until) { query += " AND created_at <= ?"; params.push(until); }
  query += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);

  const rows = await env.DB.prepare(query).bind(...params).all();
  return (rows.results || []).map(traceToSpan);
}

export async function exportMetrics(env, { projectId, since, until, limit = 200 }) {
  const params = [projectId];
  let query = "SELECT * FROM operational_metrics WHERE project_id = ?";
  if (since) { query += " AND bucket_minute >= ?"; params.push(since); }
  if (until) { query += " AND bucket_minute <= ?"; params.push(until); }
  query += " ORDER BY bucket_minute DESC LIMIT ?";
  params.push(limit);

  const rows = await env.DB.prepare(query).bind(...params).all();
  return (rows.results || []).map(metricToOtel);
}

export async function pushTraceToQueue(env, { projectId, traceId, action, targetType, targetId, actorUserId, createdAt }) {
  const configs = await env.DB.prepare(
    "SELECT id FROM otel_export_config WHERE project_id = ? AND enabled = 1 AND export_type IN ('traces', 'all')"
  )
    .bind(projectId)
    .all();

  if (!configs.results?.length) return;

  const span = buildTraceSpan({
    traceId,
    name: action,
    startTime: createdAt,
    attributes: {
      "fluxychat.project_id": projectId,
      "fluxychat.target_type": targetType || "",
      "fluxychat.target_id": targetId || "",
      "fluxychat.actor_user_id": actorUserId || "",
    },
  });

  const payload = buildOtelTracePayload([span]);

  for (const cfg of configs.results) {
    await enqueueExport(env, { configId: cfg.id, projectId, payloadType: "trace", payload });
  }
}

export async function pushMetricToQueue(env, { projectId, metricName, value, bucketMinute }) {
  const configs = await env.DB.prepare(
    "SELECT id FROM otel_export_config WHERE project_id = ? AND enabled = 1 AND export_type IN ('metrics', 'all')"
  )
    .bind(projectId)
    .all();

  if (!configs.results?.length) return;

  const metric = metricToOtel({ project_id: projectId, metric_name: metricName, metric_value: value, bucket_minute: bucketMinute });
  const payload = buildOtelMetricPayload([metric]);

  for (const cfg of configs.results) {
    await enqueueExport(env, { configId: cfg.id, projectId, payloadType: "metric", payload });
  }
}
