import { describe, it, expect } from "vitest";

function makeEnv() {
  const rows = { live_dashboards: [], dashboard_widgets: [], dashboard_data_points: [] };
  return {
    DB: {
      prepare(sql) {
        let boundParams = [];
        return {
          bind(...params) { boundParams = params; return this; },
          async run() {
            if (sql.includes("INSERT INTO live_dashboards")) {
              rows.live_dashboards.push({ id: boundParams[0], project_id: boundParams[1], name: boundParams[2], description: boundParams[3], layout: boundParams[4], refresh_interval_ms: boundParams[5], is_public: boundParams[6], owner_user_id: boundParams[7], created_at: "2026-01-10T00:00:00Z", updated_at: "2026-01-10T00:00:00Z" });
              return { meta: { changes: 1 } };
            }
            if (sql.includes("INSERT INTO dashboard_widgets")) {
              rows.dashboard_widgets.push({ id: boundParams[0], dashboard_id: boundParams[1], project_id: boundParams[2], widget_type: boundParams[3], title: boundParams[4], config: boundParams[5], position_x: boundParams[6], position_y: boundParams[7], width: boundParams[8], height: boundParams[9], created_at: "2026-01-10T00:00:00Z" });
              return { meta: { changes: 1 } };
            }
            if (sql.includes("INSERT INTO dashboard_data_points")) {
              rows.dashboard_data_points.push({ id: boundParams[0], widget_id: boundParams[1], dashboard_id: boundParams[2], project_id: boundParams[3], series_name: boundParams[4], value: boundParams[5], label: boundParams[6], timestamp: boundParams[7], metadata: boundParams[8], created_at: "2026-01-10T00:00:00Z" });
              return { meta: { changes: 1 } };
            }
            if (sql.includes("UPDATE live_dashboards")) {
              const idx = rows.live_dashboards.findIndex(r => r.project_id === boundParams[boundParams.length - 2] && r.id === boundParams[boundParams.length - 1]);
              if (idx >= 0 && sql.includes("name")) rows.live_dashboards[idx].name = boundParams[0];
              return { meta: { changes: idx >= 0 ? 1 : 0 } };
            }
            if (sql.includes("UPDATE dashboard_widgets")) {
              const idx = rows.dashboard_widgets.findIndex(r => r.project_id === boundParams[boundParams.length - 2] && r.id === boundParams[boundParams.length - 1]);
              if (idx >= 0 && sql.includes("title")) rows.dashboard_widgets[idx].title = boundParams[0];
              return { meta: { changes: idx >= 0 ? 1 : 0 } };
            }
            if (sql.includes("DELETE FROM dashboard_data_points WHERE dashboard_id")) {
              const did = boundParams[0];
              const before = rows.dashboard_data_points.length;
              rows.dashboard_data_points = rows.dashboard_data_points.filter(r => r.dashboard_id !== did);
              return { meta: { changes: before - rows.dashboard_data_points.length } };
            }
            if (sql.includes("DELETE FROM dashboard_data_points WHERE widget_id")) {
              const wid = boundParams[0];
              const before = rows.dashboard_data_points.length;
              rows.dashboard_data_points = rows.dashboard_data_points.filter(r => r.widget_id !== wid);
              return { meta: { changes: before - rows.dashboard_data_points.length } };
            }
            if (sql.includes("DELETE FROM dashboard_widgets WHERE dashboard_id")) {
              const did = boundParams[0];
              const before = rows.dashboard_widgets.length;
              rows.dashboard_widgets = rows.dashboard_widgets.filter(r => r.dashboard_id !== did);
              return { meta: { changes: before - rows.dashboard_widgets.length } };
            }
            if (sql.includes("DELETE FROM dashboard_widgets WHERE project_id")) {
              const pid = boundParams[0];
              const wid = boundParams[1];
              const before = rows.dashboard_widgets.length;
              rows.dashboard_widgets = rows.dashboard_widgets.filter(r => !(r.project_id === pid && r.id === wid));
              return { meta: { changes: before - rows.dashboard_widgets.length } };
            }
            if (sql.includes("DELETE FROM live_dashboards")) {
              const pid = boundParams[0];
              const did = boundParams[1];
              const before = rows.live_dashboards.length;
              rows.live_dashboards = rows.live_dashboards.filter(r => !(r.project_id === pid && r.id === did));
              return { meta: { changes: before - rows.live_dashboards.length } };
            }
            if (sql.includes("DELETE FROM dashboard_data_points WHERE project_id")) {
              const pid = boundParams[0];
              const ts = boundParams[1];
              const before = rows.dashboard_data_points.length;
              rows.dashboard_data_points = rows.dashboard_data_points.filter(r => !(r.project_id === pid && r.timestamp < ts));
              return { meta: { changes: before - rows.dashboard_data_points.length } };
            }
            return { meta: { changes: 1 } };
          },
          async first() {
            const pid = boundParams[0];
            if (sql.includes("FROM live_dashboards")) {
              const did = boundParams[1];
              return rows.live_dashboards.find(r => r.project_id === pid && r.id === did) || null;
            }
            if (sql.includes("FROM dashboard_widgets")) {
              const wid = boundParams[1];
              return rows.dashboard_widgets.find(r => r.project_id === pid && r.id === wid) || null;
            }
            if (sql.includes("ORDER BY timestamp DESC LIMIT 1")) {
              const wid = boundParams[1];
              const pts = rows.dashboard_data_points.filter(r => r.project_id === pid && r.widget_id === wid).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
              return pts[0] || null;
            }
            return null;
          },
          async all() {
            const pid = boundParams[0];
            if (sql.includes("FROM live_dashboards")) {
              return { results: rows.live_dashboards.filter(r => r.project_id === pid).sort((a, b) => b.updated_at.localeCompare(a.updated_at)) };
            }
            if (sql.includes("FROM dashboard_widgets")) {
              const did = boundParams[1];
              return { results: rows.dashboard_widgets.filter(r => r.project_id === pid && r.dashboard_id === did) };
            }
            if (sql.includes("FROM dashboard_data_points")) {
              const wid = boundParams[1];
              let pts = rows.dashboard_data_points.filter(r => r.project_id === pid && r.widget_id === wid);
              if (sql.includes("series_name = ?")) pts = pts.filter(r => r.series_name === boundParams[2]);
              if (sql.includes("timestamp >= ?")) pts = pts.filter(r => r.timestamp >= boundParams[sql.includes("series_name = ?") ? 3 : 2]);
              if (sql.includes("timestamp <= ?")) pts = pts.filter(r => r.timestamp <= boundParams[sql.includes("series_name = ?") ? 4 : sql.includes("timestamp >= ?") ? 3 : 2]);
              return { results: pts.sort((a, b) => a.timestamp.localeCompare(b.timestamp)).slice(0, 100) };
            }
            return { results: [] };
          },
        };
      },
    },
  };
}

import {
  createDashboard, getDashboard, listDashboards, updateDashboard, deleteDashboard,
  createWidget, getWidget, listWidgets, updateWidget, deleteWidget,
  pushDataPoint, pushBulkDataPoints, queryDataPoints, getWidgetLatest, purgeOldDataPoints,
  generateDefaultDashboard,
} from "./live-dashboards.js";

describe("P19-A: Live Dashboards", () => {
  const projectId = "proj_dash_1";

  it("creates a dashboard", async () => {
    const env = makeEnv();
    const dash = await createDashboard(env, { projectId, name: "Sales Dashboard", ownerUserId: "u1" });
    expect(dash.id).toBeDefined();
    expect(dash.name).toBe("Sales Dashboard");
    expect(dash.refreshIntervalMs).toBe(5000);
  });

  it("lists dashboards", async () => {
    const env = makeEnv();
    await createDashboard(env, { projectId, name: "D1", ownerUserId: "u1" });
    await createDashboard(env, { projectId, name: "D2", ownerUserId: "u1" });
    const list = await listDashboards(env, { projectId });
    expect(list.length).toBe(2);
  });

  it("updates dashboard", async () => {
    const env = makeEnv();
    const dash = await createDashboard(env, { projectId, name: "Old Name", ownerUserId: "u1" });
    const updated = await updateDashboard(env, { projectId, dashboardId: dash.id, updates: { name: "New Name" } });
    expect(updated.name).toBe("New Name");
  });

  it("deletes dashboard", async () => {
    const env = makeEnv();
    const dash = await createDashboard(env, { projectId, name: "To Delete", ownerUserId: "u1" });
    const deleted = await deleteDashboard(env, { projectId, dashboardId: dash.id });
    expect(deleted).toBe(true);
  });

  it("creates widgets", async () => {
    const env = makeEnv();
    const dash = await createDashboard(env, { projectId, name: "D", ownerUserId: "u1" });
    const w = await createWidget(env, { projectId, dashboardId: dash.id, widgetType: "line", title: "Revenue" });
    expect(w.widgetType).toBe("line");
    expect(w.positionX).toBe(0);
  });

  it("rejects invalid widget type", async () => {
    const env = makeEnv();
    const dash = await createDashboard(env, { projectId, name: "D", ownerUserId: "u1" });
    await expect(createWidget(env, { projectId, dashboardId: dash.id, widgetType: "invalid", title: "X" })).rejects.toThrow("Invalid widget type");
  });

  it("pushes data points", async () => {
    const env = makeEnv();
    const dash = await createDashboard(env, { projectId, name: "D", ownerUserId: "u1" });
    const w = await createWidget(env, { projectId, dashboardId: dash.id, widgetType: "counter", title: "Count" });
    const dp = await pushDataPoint(env, { projectId, widgetId: w.id, dashboardId: dash.id, value: 42 });
    expect(dp.value).toBe(42);
    expect(dp.seriesName).toBe("default");
  });

  it("queries data points", async () => {
    const env = makeEnv();
    const dash = await createDashboard(env, { projectId, name: "D", ownerUserId: "u1" });
    const w = await createWidget(env, { projectId, dashboardId: dash.id, widgetType: "line", title: "L" });
    await pushDataPoint(env, { projectId, widgetId: w.id, dashboardId: dash.id, value: 10, timestamp: "2026-01-01T00:00:00Z" });
    await pushDataPoint(env, { projectId, widgetId: w.id, dashboardId: dash.id, value: 20, timestamp: "2026-01-02T00:00:00Z" });
    const pts = await queryDataPoints(env, { projectId, widgetId: w.id });
    expect(pts.length).toBe(2);
  });

  it("gets widget latest", async () => {
    const env = makeEnv();
    const dash = await createDashboard(env, { projectId, name: "D", ownerUserId: "u1" });
    const w = await createWidget(env, { projectId, dashboardId: dash.id, widgetType: "gauge", title: "G" });
    await pushDataPoint(env, { projectId, widgetId: w.id, dashboardId: dash.id, value: 100, timestamp: "2026-01-01T00:00:00Z" });
    await pushDataPoint(env, { projectId, widgetId: w.id, dashboardId: dash.id, value: 200, timestamp: "2026-01-02T00:00:00Z" });
    const latest = await getWidgetLatest(env, { projectId, widgetId: w.id });
    expect(latest.value).toBe(200);
  });

  it("generates default dashboard", async () => {
    const env = makeEnv();
    const result = await generateDefaultDashboard(env, { projectId, ownerUserId: "u1" });
    expect(result.dashboard).toBeDefined();
    expect(result.widgets.length).toBe(6);
    expect(result.widgets[0].widgetType).toBe("counter");
  });
});
