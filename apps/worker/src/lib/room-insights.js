import { logInfo } from "./worker-log.js";

function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const VALID_TYPES = ["engagement", "activity", "sentiment", "queue", "sla", "performance", "custom"];

export function isValidInsightType(type) {
  return VALID_TYPES.includes(type);
}

export async function recordInsight(env, { projectId, roomId, insightType, metricName, metricValue, metadata }) {
  if (!isValidInsightType(insightType)) {
    return { error: `insightType must be one of: ${VALID_TYPES.join(", ")}` };
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO room_insights (project_id, room_id, insight_type, metric_name, metric_value, metadata_json, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(projectId, roomId, insightType, metricName, metricValue, metadata ? JSON.stringify(metadata) : null, now)
    .run();

  return { recorded: true };
}

export async function recordInsightsBatch(env, { projectId, roomId, insights }) {
  const now = new Date().toISOString();
  const stmts = [];
  for (const ins of insights) {
    if (!isValidInsightType(ins.insightType)) continue;
    stmts.push(
      env.DB.prepare(
        "INSERT INTO room_insights (project_id, room_id, insight_type, metric_name, metric_value, metadata_json, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(projectId, roomId, ins.insightType, ins.metricName, ins.metricValue, ins.metadata ? JSON.stringify(ins.metadata) : null, now)
    );
  }
  if (stmts.length) {
    for (const stmt of stmts) await stmt.run();
  }
  return { recorded: stmts.length };
}

export async function getLatestInsights(env, { roomId, insightType, limit = 20 }) {
  let query = "SELECT * FROM room_insights WHERE room_id = ?";
  const params = [roomId];

  if (insightType) {
    query += " AND insight_type = ?";
    params.push(insightType);
  }

  query += " ORDER BY recorded_at DESC LIMIT ?";
  params.push(limit);

  const rows = await env.DB.prepare(query).bind(...params).all();
  return (rows.results || []).map(mapInsightRow);
}

export async function getInsightSummary(env, { roomId, since }) {
  const sinceClause = since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const rows = await env.DB.prepare(
    "SELECT insight_type, metric_name, AVG(metric_value) as avg_value, MIN(metric_value) as min_value, MAX(metric_value) as max_value, COUNT(*) as sample_count FROM room_insights WHERE room_id = ? AND recorded_at >= ? GROUP BY insight_type, metric_name ORDER BY insight_type, metric_name"
  )
    .bind(roomId, sinceClause)
    .all();

  return (rows.results || []).map((r) => ({
    insightType: r.insight_type,
    metricName: r.metric_name,
    avgValue: r.avg_value,
    minValue: r.min_value,
    maxValue: r.max_value,
    sampleCount: r.sample_count,
  }));
}

export async function getInsightTimeSeries(env, { roomId, metricName, since, until }) {
  let query = "SELECT metric_value, recorded_at FROM room_insights WHERE room_id = ? AND metric_name = ?";
  const params = [roomId, metricName];

  if (since) { query += " AND recorded_at >= ?"; params.push(since); }
  if (until) { query += " AND recorded_at <= ?"; params.push(until); }
  query += " ORDER BY recorded_at ASC";

  const rows = await env.DB.prepare(query).bind(...params).all();
  return (rows.results || []).map((r) => ({
    value: r.metric_value,
    recordedAt: r.recorded_at,
  }));
}

export async function computeEngagementScore(env, { roomId }) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const rows = await env.DB.prepare(
    "SELECT metric_name, metric_value FROM room_insights WHERE room_id = ? AND insight_type = 'activity' AND recorded_at >= ?"
  )
    .bind(roomId, since)
    .all();

  const metrics = {};
  for (const r of rows.results || []) {
    metrics[r.metric_name] = (metrics[r.metric_name] || 0) + r.metric_value;
  }

  const messageRate = metrics.message_rate || 0;
  const activeUsers = metrics.active_users || 0;
  const responseTime = metrics.avg_response_time || 5000;

  const score = Math.min(100, Math.round(
    (messageRate * 10) + (activeUsers * 5) + Math.max(0, 100 - responseTime / 100)
  ));

  return {
    score,
    components: { messageRate, activeUsers, responseTime },
    computedAt: new Date().toISOString(),
  };
}

export async function subscribeToInsights(env, { projectId, roomId, userId, insightTypes, intervalSeconds }) {
  const id = `sub_${generateId().slice(0, 12)}`;
  const now = new Date().toISOString();

  await env.DB.prepare(
    "INSERT INTO room_insight_subscriptions (id, project_id, room_id, user_id, insight_types_json, interval_seconds, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)"
  )
    .bind(id, projectId, roomId, userId, JSON.stringify(insightTypes || VALID_TYPES), intervalSeconds || 30, now)
    .run();

  return { id, created: true };
}

export async function getInsightSubscriptions(env, { roomId }) {
  const rows = await env.DB.prepare(
    "SELECT * FROM room_insight_subscriptions WHERE room_id = ? AND enabled = 1"
  )
    .bind(roomId)
    .all();

  return (rows.results || []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    insightTypes: JSON.parse(r.insight_types_json || "[]"),
    intervalSeconds: r.interval_seconds,
  }));
}

export async function unsubscribeFromInsights(env, { id }) {
  const result = await env.DB.prepare(
    "DELETE FROM room_insight_subscriptions WHERE id = ?"
  )
    .bind(id)
    .run();
  return { deleted: result.meta?.changes || 0 };
}

export async function cleanupOldInsights(env, { roomId, olderThanHours = 168 }) {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString();
  const result = await env.DB.prepare(
    "DELETE FROM room_insights WHERE room_id = ? AND recorded_at < ?"
  )
    .bind(roomId, cutoff)
    .run();
  return { deleted: result.meta?.changes || 0 };
}

function mapInsightRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    roomId: row.room_id,
    insightType: row.insight_type,
    metricName: row.metric_name,
    metricValue: row.metric_value,
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : null,
    recordedAt: row.recorded_at,
  };
}
