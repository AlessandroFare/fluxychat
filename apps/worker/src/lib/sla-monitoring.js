/**
 * P18-H: SLA 99.9% Monitoring
 * SLO/SLA tracking, uptime monitoring, latency percentiles, error budgets,
 * breach notifications, and public status page data.
 */

function generateId() {
  return `sla_${crypto.randomUUID().slice(0, 12)}`;
}

function nowIso() {
  return new Date().toISOString();
}

/* ── SLO Definitions ── */

export async function createSloDefinition(env, { projectId, name, target, windowDays, metricType, description }) {
  const id = generateId();
  const now = nowIso();

  await env.DB.prepare(
    `INSERT INTO slo_definitions (id, project_id, name, target, window_days, metric_type, description, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  )
    .bind(id, projectId, name, target || 99.9, windowDays || 30, metricType || 'availability', description || '', now, now)
    .run();

  return { id, projectId, name, target: target || 99.9, windowDays: windowDays || 30, metricType: metricType || 'availability', description: description || '', enabled: true, createdAt: now, updatedAt: now };
}

export async function listSloDefinitions(env, { projectId }) {
  const rows = await env.DB.prepare(
    `SELECT * FROM slo_definitions WHERE project_id = ? ORDER BY created_at DESC`
  )
    .bind(projectId)
    .all();
  return (rows.results || []).map(mapSloRow);
}

/* ── SLI Data Points ── */

export async function recordSliDataPoint(env, { projectId, sloId, timestamp, value, metadata }) {
  const id = generateId();
  const now = nowIso();

  await env.DB.prepare(
    `INSERT INTO sli_data_points (id, project_id, slo_id, timestamp, value, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, projectId, sloId, timestamp || now, value, JSON.stringify(metadata || {}), now)
    .run();

  return { id, projectId, sloId, timestamp: timestamp || now, value, metadata: metadata || {}, createdAt: now };
}

export async function getSliDataPoints(env, { projectId, sloId, startTime, endTime, limit = 1000 }) {
  let sql = `SELECT * FROM sli_data_points WHERE project_id = ? AND slo_id = ?`;
  const binds = [projectId, sloId];

  if (startTime) { sql += ` AND timestamp >= ?`; binds.push(startTime); }
  if (endTime) { sql += ` AND timestamp <= ?`; binds.push(endTime); }
  sql += ` ORDER BY timestamp DESC LIMIT ?`;
  binds.push(Math.min(limit, 10000));

  const rows = await env.DB.prepare(sql).bind(...binds).all();
  return (rows.results || []).map(mapSliRow);
}

/* ── SLA Calculation ── */

export async function calculateSlaStatus(env, { projectId, sloId, windowDays }) {
  const slo = await getSloDefinition(env, { projectId, sloId });
  if (!slo) return null;

  const window = windowDays || slo.windowDays;
  const startTime = new Date(Date.now() - window * 24 * 60 * 60 * 1000).toISOString();
  const points = await getSliDataPoints(env, { projectId, sloId, startTime });

  if (points.length === 0) {
    return {
      sloId, name: slo.name, target: slo.target, windowDays: window,
      actualUptime: null, errorBudgetRemaining: 100, status: 'no_data',
      totalDataPoints: 0, breachDetected: false,
    };
  }

  const total = points.length;
  const successful = points.filter(p => p.value >= 1).length;
  const actualUptime = (successful / total) * 100;
  const errorBudgetRemaining = Math.max(0, slo.target - actualUptime + (100 - slo.target));
  const breachDetected = actualUptime < slo.target;

  // Latency percentiles
  const latencies = points.filter(p => p.metadata?.latencyMs !== undefined).map(p => p.metadata.latencyMs).sort((a, b) => a - b);
  const p50 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] : null;
  const p95 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : null;
  const p99 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.99)] : null;

  return {
    sloId, name: slo.name, target: slo.target, windowDays: window,
    actualUptime: Math.round(actualUptime * 10000) / 10000,
    errorBudgetRemaining: Math.round(errorBudgetRemaining * 10000) / 10000,
    status: breachDetected ? 'breaching' : 'healthy',
    totalDataPoints: total,
    breachDetected,
    latencyPercentiles: { p50, p95, p99 },
  };
}

/* ── Error Budget Alerts ── */

export async function checkErrorBudgetAlerts(env, { projectId }) {
  const slos = await listSloDefinitions(env, { projectId });
  const alerts = [];

  for (const slo of slos) {
    const status = await calculateSlaStatus(env, { projectId, sloId: slo.id });
    if (!status || status.status === 'no_data') continue;

    if (status.breachDetected) {
      alerts.push({
        sloId: slo.id, name: slo.name, type: 'breach',
        message: `SLO "${slo.name}" is breaching: ${status.actualUptime}% < ${slo.target}%`,
        actualUptime: status.actualUptime, target: slo.target,
      });
    } else if (status.errorBudgetRemaining < 20) {
      alerts.push({
        sloId: slo.id, name: slo.name, type: 'warning',
        message: `SLO "${slo.name}" error budget low: ${status.errorBudgetRemaining.toFixed(2)}% remaining`,
        errorBudgetRemaining: status.errorBudgetRemaining,
      });
    }
  }

  return alerts;
}

/* ── Public Status Page ── */

export async function getStatusPageData(env, { projectId }) {
  const slos = await listSloDefinitions(env, { projectId });
  const statuses = [];

  for (const slo of slos) {
    const status = await calculateSlaStatus(env, { projectId, sloId: slo.id });
    statuses.push({
      name: slo.name,
      target: slo.target,
      status: status?.status || 'no_data',
      actualUptime: status?.actualUptime,
      last30Days: status ? {
        uptime: status.actualUptime,
        errorBudgetRemaining: status.errorBudgetRemaining,
        totalDataPoints: status.totalDataPoints,
      } : null,
    });
  }

  const overallStatus = statuses.every(s => s.status === 'healthy' || s.status === 'no_data')
    ? 'operational'
    : statuses.some(s => s.status === 'breaching') ? 'degraded' : 'partial_outage';

  return {
    projectId,
    overallStatus,
    lastUpdated: nowIso(),
    services: statuses,
  };
}

/* ── Helpers ── */

async function getSloDefinition(env, { projectId, sloId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM slo_definitions WHERE id = ? AND project_id = ?`
  )
    .bind(sloId, projectId)
    .first();
  return row ? mapSloRow(row) : null;
}

function mapSloRow(row) {
  return {
    id: row.id, projectId: row.project_id, name: row.name,
    target: row.target, windowDays: row.window_days,
    metricType: row.metric_type, description: row.description ?? '',
    enabled: row.enabled === 1, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapSliRow(row) {
  return {
    id: row.id, projectId: row.project_id, sloId: row.slo_id,
    timestamp: row.timestamp, value: row.value,
    metadata: tryParse(row.metadata), createdAt: row.created_at,
  };
}

function tryParse(json) {
  try { return JSON.parse(json); } catch { return json; }
}
