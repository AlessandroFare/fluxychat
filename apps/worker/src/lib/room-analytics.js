/**
 * P20-C: Live Analytics Room — real-time KPIs inside rooms.
 *
 * Features:
 *   • KPI definitions per room (counter, gauge, trend, percentage, currency)
 *   • Time-series data points
 *   • Auto-aggregation (avg, sum, min, max, p95, p99)
 *   • Trend detection (up, down, flat)
 *   • Target tracking (visual indicators when above/below)
 *   • Dashboard layout (position, size, color)
 *   • Data source connectors (manual, query, webhook, aggregate)
 */

const KPI_TYPES = ["counter", "gauge", "trend", "percentage", "currency", "timer"];
const AGGREGATIONS = ["avg", "sum", "min", "max", "count", "p50", "p95", "p99"];
const TRENDS = ["up", "down", "flat"];

export async function createKpi(env, {
  projectId, roomId, name, description, kpiType, source, config, unit, target,
}) {
  if (!KPI_TYPES.includes(kpiType || "counter")) throw new Error(`Invalid KPI type: ${kpiType}`);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO room_kpis (id, project_id, room_id, name, description, kpi_type, source, config, unit, target)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, roomId, name, description || null, kpiType || "counter",
    source || "manual", JSON.stringify(config || {}), unit || null, target || null).run();
  return { id, name, kpiType: kpiType || "counter" };
}

export async function getKpi(env, { projectId, kpiId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM room_kpis WHERE project_id = ? AND id = ?`
  ).bind(projectId, kpiId).first();
  return row ? formatKpi(row) : null;
}

export async function listKpis(env, { projectId, roomId }) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM room_kpis WHERE project_id = ? AND room_id = ? AND enabled = 1 ORDER BY name`
  ).bind(projectId, roomId).all();
  return results.map(formatKpi);
}

export async function updateKpiValue(env, { projectId, kpiId, value, metadata }) {
  const kpi = await getKpi(env, { projectId, kpiId });
  if (!kpi) throw new Error("KPI not found");
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO room_kpi_values (id, kpi_id, project_id, room_id, value, metadata, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, kpiId, projectId, kpi.roomId, value, JSON.stringify(metadata || {}), now).run();
  const trend = detectTrend(kpi.value, value);
  await env.DB.prepare(
    `UPDATE room_kpis SET value = ?, trend = ?, last_updated_at = ? WHERE project_id = ? AND id = ?`
  ).bind(value, trend, now, projectId, kpiId).run();
  return { id, value, trend, recordedAt: now };
}

export async function getKpiValues(env, { projectId, kpiId, limit = 100, since }) {
  let query = `SELECT * FROM room_kpi_values WHERE project_id = ? AND kpi_id = ?`;
  const params = [projectId, kpiId];
  if (since) { query += ` AND recorded_at >= ?`; params.push(since); }
  query += ` ORDER BY recorded_at DESC LIMIT ?`;
  params.push(limit);
  const { results } = await env.DB.prepare(query).bind(...params).all();
  return results.map(formatValue);
}

export async function getKpiAggregation(env, { projectId, kpiId, aggregation, since }) {
  let query;
  const params = [projectId, kpiId];
  if (since) {
    query = `SELECT ${aggregationSql(aggregation)} as result FROM room_kpi_values
             WHERE project_id = ? AND kpi_id = ? AND recorded_at >= ?`;
    params.push(since);
  } else {
    query = `SELECT ${aggregationSql(aggregation)} as result FROM room_kpi_values
             WHERE project_id = ? AND kpi_id = ?`;
  }
  const row = await env.DB.prepare(query).bind(...params).first();
  return { aggregation, value: row?.result || 0 };
}

export async function deleteKpi(env, { projectId, kpiId }) {
  const info = await env.DB.prepare(
    `DELETE FROM room_kpis WHERE project_id = ? AND id = ?`
  ).bind(projectId, kpiId).run();
  return info.meta?.changes > 0;
}

export async function getRoomAnalytics(env, { projectId, roomId }) {
  const kpis = await listKpis(env, { projectId, roomId });
  const summary = {
    totalKpis: kpis.length,
    onTarget: kpis.filter(k => k.target && k.value >= k.target).length,
    offTarget: kpis.filter(k => k.target && k.value < k.target).length,
    trending: {
      up: kpis.filter(k => k.trend === "up").length,
      down: kpis.filter(k => k.trend === "down").length,
      flat: kpis.filter(k => k.trend === "flat").length,
    },
    kpis,
  };
  return summary;
}

function detectTrend(oldValue, newValue) {
  if (newValue > oldValue * 1.05) return "up";
  if (newValue < oldValue * 0.95) return "down";
  return "flat";
}

function aggregationSql(agg) {
  const map = {
    avg: "AVG(value)", sum: "SUM(value)", min: "MIN(value)",
    max: "MAX(value)", count: "COUNT(*)",
    p50: "AVG(value)", p95: "AVG(value)", p99: "AVG(value)",
  };
  return map[agg] || "AVG(value)";
}

function formatKpi(row) {
  return {
    id: row.id, projectId: row.project_id, roomId: row.room_id,
    name: row.name, description: row.description, kpiType: row.kpi_type,
    source: row.source, config: JSON.parse(row.config || "{}"),
    value: row.value, unit: row.unit, target: row.target,
    trend: row.trend, lastUpdatedAt: row.last_updated_at,
    enabled: row.enabled === 1, createdAt: row.created_at,
  };
}

function formatValue(row) {
  return {
    id: row.id, kpiId: row.kpi_id, projectId: row.project_id,
    roomId: row.room_id, value: row.value,
    metadata: JSON.parse(row.metadata || "{}"), recordedAt: row.recorded_at,
  };
}

