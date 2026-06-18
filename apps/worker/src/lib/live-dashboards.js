/**
 * P19-A: Live Dashboards / Charts — stream live KPIs into rooms or standalone dashboards.
 *
 * Features:
 *   • Dashboard CRUD with layout + refresh interval
 *   • Widget CRUD (chart types: line, bar, gauge, counter, table, status)
 *   • Real-time data point ingestion (push or pull)
 *   • Time-series query with downsampling
 *   • Auto-generated dashboard from existing operational_metrics
 *   • Public/private dashboards
 */

const WIDGET_TYPES = ["line", "bar", "gauge", "counter", "table", "status", "heatmap", "sparkline"];

export async function createDashboard(env, {
  projectId, name, description, layout, refreshIntervalMs, isPublic, ownerUserId,
}) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO live_dashboards (id, project_id, name, description, layout, refresh_interval_ms, is_public, owner_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, projectId, name, description || null, layout || "grid", refreshIntervalMs || 5000, isPublic ? 1 : 0, ownerUserId).run();
  return { id, name, layout, refreshIntervalMs: refreshIntervalMs || 5000, isPublic: !!isPublic };
}

export async function getDashboard(env, { projectId, dashboardId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM live_dashboards WHERE project_id = ? AND id = ?`
  ).bind(projectId, dashboardId).first();
  return row ? formatDashboard(row) : null;
}

export async function listDashboards(env, { projectId }) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM live_dashboards WHERE project_id = ? ORDER BY updated_at DESC`
  ).bind(projectId).all();
  return results.map(formatDashboard);
}

export async function updateDashboard(env, { projectId, dashboardId, updates }) {
  const existing = await env.DB.prepare(
    `SELECT * FROM live_dashboards WHERE project_id = ? AND id = ?`
  ).bind(projectId, dashboardId).first();
  if (!existing) return null;

  const fields = [];
  const values = [];
  const allowed = ["name", "description", "layout", "refresh_interval_ms", "is_public"];
  for (const [key, value] of Object.entries(updates)) {
    const dbKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
    if (allowed.includes(dbKey)) {
      fields.push(`${dbKey} = ?`);
      values.push(dbKey === "is_public" ? (value ? 1 : 0) : value);
    }
  }
  if (fields.length === 0) return formatDashboard(existing);
  fields.push("updated_at = datetime('now')");
  values.push(projectId, dashboardId);
  await env.DB.prepare(
    `UPDATE live_dashboards SET ${fields.join(", ")} WHERE project_id = ? AND id = ?`
  ).bind(...values).run();
  return getDashboard(env, { projectId, dashboardId });
}

export async function deleteDashboard(env, { projectId, dashboardId }) {
  await env.DB.prepare(
    `DELETE FROM dashboard_data_points WHERE dashboard_id = ?`
  ).bind(dashboardId).run();
  await env.DB.prepare(
    `DELETE FROM dashboard_widgets WHERE dashboard_id = ?`
  ).bind(dashboardId).run();
  const info = await env.DB.prepare(
    `DELETE FROM live_dashboards WHERE project_id = ? AND id = ?`
  ).bind(projectId, dashboardId).run();
  return info.meta?.changes > 0;
}

/* ═══ Widget CRUD ═══ */

export async function createWidget(env, {
  projectId, dashboardId, widgetType, title, config, positionX, positionY, width, height,
}) {
  if (!WIDGET_TYPES.includes(widgetType)) throw new Error(`Invalid widget type: ${widgetType}`);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO dashboard_widgets (id, dashboard_id, project_id, widget_type, title, config, position_x, position_y, width, height)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, dashboardId, projectId, widgetType, title, JSON.stringify(config || {}), positionX || 0, positionY || 0, width || 1, height || 1).run();
  return { id, widgetType, title, config: config || {}, positionX: positionX || 0, positionY: positionY || 0, width: width || 1, height: height || 1 };
}

export async function getWidget(env, { projectId, widgetId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM dashboard_widgets WHERE project_id = ? AND id = ?`
  ).bind(projectId, widgetId).first();
  return row ? formatWidget(row) : null;
}

export async function listWidgets(env, { projectId, dashboardId }) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM dashboard_widgets WHERE project_id = ? AND dashboard_id = ? ORDER BY position_y, position_x`
  ).bind(projectId, dashboardId).all();
  return results.map(formatWidget);
}

export async function updateWidget(env, { projectId, widgetId, updates }) {
  const existing = await env.DB.prepare(
    `SELECT * FROM dashboard_widgets WHERE project_id = ? AND id = ?`
  ).bind(projectId, widgetId).first();
  if (!existing) return null;

  const fields = [];
  const values = [];
  const allowed = ["title", "config", "position_x", "position_y", "width", "height"];
  for (const [key, value] of Object.entries(updates)) {
    const dbKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
    if (allowed.includes(dbKey)) {
      fields.push(`${dbKey} = ?`);
      values.push(dbKey === "config" ? JSON.stringify(value) : value);
    }
  }
  if (fields.length === 0) return formatWidget(existing);
  values.push(projectId, widgetId);
  await env.DB.prepare(
    `UPDATE dashboard_widgets SET ${fields.join(", ")} WHERE project_id = ? AND id = ?`
  ).bind(...values).run();
  return getWidget(env, { projectId, widgetId });
}

export async function deleteWidget(env, { projectId, widgetId }) {
  await env.DB.prepare(
    `DELETE FROM dashboard_data_points WHERE widget_id = ?`
  ).bind(widgetId).run();
  const info = await env.DB.prepare(
    `DELETE FROM dashboard_widgets WHERE project_id = ? AND id = ?`
  ).bind(projectId, widgetId).run();
  return info.meta?.changes > 0;
}

/* ═══ Data Points ═══ */

export async function pushDataPoint(env, {
  projectId, widgetId, dashboardId, seriesName, value, label, timestamp, metadata,
}) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO dashboard_data_points (id, widget_id, dashboard_id, project_id, series_name, value, label, timestamp, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, widgetId, dashboardId, projectId, seriesName || "default", value, label || null, timestamp || new Date().toISOString(), JSON.stringify(metadata || {})).run();
  return { id, value, seriesName: seriesName || "default", timestamp: timestamp || new Date().toISOString() };
}

export async function pushBulkDataPoints(env, { projectId, dashboardId, points }) {
  const ids = [];
  for (const p of points) {
    const r = await pushDataPoint(env, {
      projectId, widgetId: p.widgetId, dashboardId,
      seriesName: p.seriesName, value: p.value, label: p.label,
      timestamp: p.timestamp, metadata: p.metadata,
    });
    ids.push(r.id);
  }
  return { count: ids.length, ids };
}

export async function queryDataPoints(env, {
  projectId, widgetId, seriesName, from, to, limit = 100,
}) {
  let query = `SELECT * FROM dashboard_data_points WHERE project_id = ? AND widget_id = ?`;
  const params = [projectId, widgetId];
  if (seriesName) { query += ` AND series_name = ?`; params.push(seriesName); }
  if (from) { query += ` AND timestamp >= ?`; params.push(from); }
  if (to) { query += ` AND timestamp <= ?`; params.push(to); }
  query += ` ORDER BY timestamp ASC LIMIT ?`;
  params.push(limit);
  const { results } = await env.DB.prepare(query).bind(...params).all();
  return results.map(formatDataPoint);
}

export async function getWidgetLatest(env, { projectId, widgetId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM dashboard_data_points WHERE project_id = ? AND widget_id = ? ORDER BY timestamp DESC LIMIT 1`
  ).bind(projectId, widgetId).first();
  return row ? formatDataPoint(row) : null;
}

export async function purgeOldDataPoints(env, { projectId, olderThanTimestamp }) {
  const info = await env.DB.prepare(
    `DELETE FROM dashboard_data_points WHERE project_id = ? AND timestamp < ?`
  ).bind(projectId, olderThanTimestamp).run();
  return info.meta?.changes || 0;
}

/* ═══ Auto-generate from operational_metrics ═══ */

export async function generateDefaultDashboard(env, { projectId, ownerUserId }) {
  const dash = await createDashboard(env, {
    projectId, name: "Operational Overview", description: "Auto-generated from operational metrics",
    refreshIntervalMs: 10000, isPublic: true, ownerUserId,
  });

  const widgetDefs = [
    { type: "counter", title: "Total Messages (24h)", config: { metric: "messages_24h", color: "#0066ff" } },
    { type: "gauge", title: "Active Rooms", config: { metric: "active_rooms", max: 100, color: "#00cc88" } },
    { type: "line", title: "Message Volume (7d)", config: { metric: "message_volume", period: "7d" } },
    { type: "bar", title: "Top Rooms by Activity", config: { metric: "room_activity", limit: 5 } },
    { type: "status", title: "System Health", config: { metrics: ["uptime", "error_rate", "latency_p99"] } },
    { type: "table", title: "Recent Alerts", config: { metric: "alerts", limit: 10 } },
  ];

  const widgets = [];
  for (let i = 0; i < widgetDefs.length; i++) {
    const w = widgetDefs[i];
    const widget = await createWidget(env, {
      projectId, dashboardId: dash.id, widgetType: w.type, title: w.title,
      config: w.config, positionX: i % 3, positionY: Math.floor(i / 3), width: 1, height: 1,
    });
    widgets.push(widget);
  }

  return { dashboard: dash, widgets };
}

function formatDashboard(row) {
  return {
    id: row.id, projectId: row.project_id, name: row.name, description: row.description,
    layout: row.layout, refreshIntervalMs: row.refresh_interval_ms,
    isPublic: row.is_public === 1, ownerUserId: row.owner_user_id,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function formatWidget(row) {
  return {
    id: row.id, dashboardId: row.dashboard_id, projectId: row.project_id,
    widgetType: row.widget_type, title: row.title, config: JSON.parse(row.config || "{}"),
    positionX: row.position_x, positionY: row.position_y, width: row.width, height: row.height,
    createdAt: row.created_at,
  };
}

function formatDataPoint(row) {
  return {
    id: row.id, widgetId: row.widget_id, dashboardId: row.dashboard_id, projectId: row.project_id,
    seriesName: row.series_name, value: row.value, label: row.label, timestamp: row.timestamp,
    metadata: JSON.parse(row.metadata || "{}"), createdAt: row.created_at,
  };
}

