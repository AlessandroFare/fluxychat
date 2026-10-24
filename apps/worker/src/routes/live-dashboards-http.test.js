import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchDashboardRoutes } from "./live-dashboards-http.js";

vi.mock("../lib/live-dashboards.js", () => ({
  createDashboard: vi.fn(),
  getDashboard: vi.fn(),
  listDashboards: vi.fn(),
  updateDashboard: vi.fn(),
  deleteDashboard: vi.fn(),
  createWidget: vi.fn(),
  getWidget: vi.fn(),
  listWidgets: vi.fn(),
  updateWidget: vi.fn(),
  deleteWidget: vi.fn(),
  pushDataPoint: vi.fn(),
  pushBulkDataPoints: vi.fn(),
  queryDataPoints: vi.fn(),
  getWidgetLatest: vi.fn(),
  purgeOldDataPoints: vi.fn(),
  generateDefaultDashboard: vi.fn(),
}));

import {
  createDashboard,
  createWidget,
  deleteDashboard,
  deleteWidget,
  generateDefaultDashboard,
  getDashboard,
  getWidget,
  getWidgetLatest,
  listDashboards,
  listWidgets,
  purgeOldDataPoints,
  pushBulkDataPoints,
  pushDataPoint,
  queryDataPoints,
  updateDashboard,
  updateWidget,
} from "../lib/live-dashboards.js";

function makeHandler(roles = ["admin"], overrides = {}) {
  return {
    env: { DB: {} },
    json: (body, init = {}) =>
      new Response(JSON.stringify(body), {
        status: init.status || 200,
        headers: { "content-type": "application/json", ...(init.headers || {}) },
      }),
    corsHeaders: {},
    requestLogCtx: {},
    verifyJwtAndGetContext: async () => ({ projectId: "p1", userId: "u1", roles }),
    hasAnyRole: (roles, allowed) => Array.isArray(roles) && roles.some((role) => allowed.includes(role)),
    logError: vi.fn(),
    ...overrides,
  };
}

async function call(handler, method, path, body) {
  const request = new Request(`https://worker.test${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return dispatchDashboardRoutes(request, new URL(request.url), handler);
}

beforeEach(() => {
  vi.clearAllMocks();
  createDashboard.mockResolvedValue({ id: "dash-1", name: "Ops" });
  getDashboard.mockResolvedValue(null);
  listDashboards.mockResolvedValue([]);
  updateDashboard.mockResolvedValue(null);
  deleteDashboard.mockResolvedValue(true);
  createWidget.mockResolvedValue({ id: "widget-1" });
  getWidget.mockResolvedValue(null);
  listWidgets.mockResolvedValue([]);
  updateWidget.mockResolvedValue(null);
  deleteWidget.mockResolvedValue(true);
  pushDataPoint.mockResolvedValue({ id: "point-1", value: 1 });
  pushBulkDataPoints.mockResolvedValue({ inserted: 2 });
  queryDataPoints.mockResolvedValue([]);
  getWidgetLatest.mockResolvedValue(null);
  purgeOldDataPoints.mockResolvedValue(3);
  generateDefaultDashboard.mockResolvedValue({ id: "dash-default" });
});

describe("live dashboard routes", () => {
  it("returns 401 without a JWT and 401 for a member", async () => {
    const noAuth = makeHandler(["admin"], { verifyJwtAndGetContext: async () => null });
    expect((await call(noAuth, "GET", "/enterprise/dashboards")).status).toBe(401);

    const member = makeHandler(["member"]);
    expect((await call(member, "GET", "/enterprise/dashboards")).status).toBe(401);
  });

  it("validates dashboard create input and scopes it to the token", async () => {
    const handler = makeHandler();
    expect((await call(handler, "POST", "/enterprise/dashboards", {})).status).toBe(400);

    const res = await call(handler, "POST", "/enterprise/dashboards", {
      name: "Ops",
      layout: { columns: 2 },
      isPublic: true,
    });
    expect(res.status).toBe(201);
    expect(createDashboard).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      name: "Ops",
      description: undefined,
      layout: { columns: 2 },
      refreshIntervalMs: undefined,
      isPublic: true,
      ownerUserId: "u1",
    });
  });

  it("lists dashboards with a count", async () => {
    listDashboards.mockResolvedValue([{ id: "dash-1" }]);
    const res = await call(makeHandler(), "GET", "/enterprise/dashboards");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ dashboards: [{ id: "dash-1" }], count: 1 });
  });

  it("returns 404 for a missing dashboard", async () => {
    const res = await call(makeHandler(), "GET", "/enterprise/dashboards/dash-missing");
    expect(res.status).toBe(404);
    expect(getDashboard).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      dashboardId: "dash-missing",
    });
  });

  it("returns a dashboard with its widgets", async () => {
    getDashboard.mockResolvedValue({ id: "dash-1", name: "Ops" });
    listWidgets.mockResolvedValue([{ id: "widget-1" }]);
    const res = await call(makeHandler(), "GET", "/enterprise/dashboards/dash-1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: "dash-1",
      name: "Ops",
      widgets: [{ id: "widget-1" }],
    });
  });

  it("creates and lists widgets", async () => {
    const handler = makeHandler();
    const invalid = await call(handler, "POST", "/enterprise/dashboards/dash-1/widgets", { title: "CPU" });
    expect(invalid.status).toBe(400);

    const created = await call(handler, "POST", "/enterprise/dashboards/dash-1/widgets", {
      widgetType: "line",
      title: "CPU",
      config: { series: "cpu" },
    });
    expect(created.status).toBe(201);
    expect(createWidget).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      dashboardId: "dash-1",
      widgetType: "line",
      title: "CPU",
      config: { series: "cpu" },
      positionX: undefined,
      positionY: undefined,
      width: undefined,
      height: undefined,
    });

    listWidgets.mockResolvedValue([{ id: "widget-1" }]);
    const list = await call(handler, "GET", "/enterprise/dashboards/dash-1/widgets");
    expect(await list.json()).toEqual({ widgets: [{ id: "widget-1" }], count: 1 });
  });

  it("maps missing widget update/delete correctly", async () => {
    const handler = makeHandler();
    const missing = await call(handler, "GET", "/enterprise/widgets/widget-missing");
    expect(missing.status).toBe(404);

    const patch = await call(handler, "PATCH", "/enterprise/widgets/widget-missing", { title: "New" });
    expect(patch.status).toBe(404);
    expect(updateWidget).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      widgetId: "widget-missing",
      updates: { title: "New" },
    });

    const del = await call(handler, "DELETE", "/enterprise/widgets/widget-1");
    expect(del.status).toBe(200);
    expect(await del.json()).toEqual({ deleted: true });
  });

  it("requires a value or points when ingesting data", async () => {
    const handler = makeHandler();
    expect((await call(handler, "POST", "/enterprise/widgets/widget-1/data", {})).status).toBe(400);

    const missingWidget = await call(handler, "POST", "/enterprise/widgets/widget-1/data", { value: 1 });
    expect(missingWidget.status).toBe(404);

    getWidget.mockResolvedValue({ id: "widget-1", dashboardId: "dash-1" });
    const res = await call(handler, "POST", "/enterprise/widgets/widget-1/data", {
      value: 42,
      seriesName: "cpu",
    });
    expect(res.status).toBe(201);
    expect(pushDataPoint).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      widgetId: "widget-1",
      dashboardId: "dash-1",
      seriesName: "cpu",
      value: 42,
      label: undefined,
      timestamp: undefined,
      metadata: undefined,
    });
  });

  it("accepts a bulk point ingest without a widget lookup", async () => {
    const res = await call(makeHandler(), "POST", "/enterprise/widgets/widget-1/data", {
      points: [{ seriesName: "cpu", value: 1 }],
    });
    expect(res.status).toBe(201);
    expect(pushBulkDataPoints).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      dashboardId: null,
      points: [{ seriesName: "cpu", value: 1 }],
    });
    expect(getWidget).not.toHaveBeenCalled();
  });

  it("queries data points and latest values", async () => {
    queryDataPoints.mockResolvedValue([{ value: 1 }]);
    const res = await call(
      makeHandler(),
      "GET",
      "/enterprise/widgets/widget-1/data?series=cpu&limit=5",
    );
    expect(res.status).toBe(200);
    expect(queryDataPoints).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      widgetId: "widget-1",
      seriesName: "cpu",
      from: undefined,
      to: undefined,
      limit: 5,
    });

    const missing = await call(makeHandler(), "GET", "/enterprise/widgets/widget-1/latest");
    expect(missing.status).toBe(404);
  });

  it("validates purge input and generates the default dashboard", async () => {
    const handler = makeHandler();
    expect((await call(handler, "POST", "/enterprise/dashboards/purge", {})).status).toBe(400);

    const purge = await call(handler, "POST", "/enterprise/dashboards/purge", {
      olderThan: "2026-01-01T00:00:00.000Z",
    });
    expect(purge.status).toBe(200);
    expect(purgeOldDataPoints).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      olderThanTimestamp: "2026-01-01T00:00:00.000Z",
    });

    const generated = await call(handler, "POST", "/enterprise/dashboards/default");
    expect(generated.status).toBe(201);
    expect(generateDefaultDashboard).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      ownerUserId: "u1",
    });
  });

  it("returns null for unrelated paths", async () => {
    expect(await call(makeHandler(), "GET", "/enterprise/other")).toBeNull();
  });
});
