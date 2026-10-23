import { beforeEach, describe, expect, it, vi } from "vitest";
import { json } from "../lib/http-json.js";
import { dispatchAuditExportRoutes } from "./audit-export-http.js";

vi.mock("../lib/audit-log-export.js", () => ({
  createExportSchedule: vi.fn(),
  listExportSchedules: vi.fn(),
  deleteExportSchedule: vi.fn(),
  toggleExportSchedule: vi.fn(),
  queryFilteredAuditEvents: vi.fn(),
  streamExport: vi.fn(),
  recordExportRun: vi.fn(),
  getExportRuns: vi.fn(),
  getAuditStats: vi.fn(),
}));

import {
  createExportSchedule,
  deleteExportSchedule,
  getAuditStats,
  getExportRuns,
  listExportSchedules,
  queryFilteredAuditEvents,
  streamExport,
  toggleExportSchedule,
} from "../lib/audit-log-export.js";

function makeHandler(roles = ["admin"], overrides = {}) {
  return {
    env: {},
    json,
    corsHeaders: {},
    verifyJwtAndGetContext: async () => ({ projectId: "p1", userId: "u1", roles }),
    hasAnyRole: (roles, allowed) => Array.isArray(roles) && roles.some((role) => allowed.includes(role)),
    ...overrides,
  };
}

async function call(handler, method, path, body) {
  const request = new Request(`https://worker.test${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return dispatchAuditExportRoutes(request, new URL(request.url), handler);
}

beforeEach(() => {
  vi.clearAllMocks();
  createExportSchedule.mockResolvedValue({ id: "aes_1" });
  listExportSchedules.mockResolvedValue([]);
  deleteExportSchedule.mockResolvedValue({ deleted: 1 });
  toggleExportSchedule.mockResolvedValue({ updated: 1 });
  queryFilteredAuditEvents.mockResolvedValue([]);
  streamExport.mockResolvedValue("id,action\n1,login\n");
  getExportRuns.mockResolvedValue([]);
  getAuditStats.mockResolvedValue({ total: 0 });
});

describe("audit export routes", () => {
  it("returns 401 without a JWT and 403 for a member", async () => {
    const noAuth = makeHandler(["admin"], { verifyJwtAndGetContext: async () => null });
    expect((await call(noAuth, "GET", "/admin/audit-export/schedules")).status).toBe(401);

    const member = makeHandler(["member"]);
    expect((await call(member, "GET", "/admin/audit-export/schedules")).status).toBe(403);
  });

  it("returns null for unrelated paths once authenticated", async () => {
    expect(await call(makeHandler(), "GET", "/admin/audit-export-other")).toBeNull();
  });

  it("lists schedules", async () => {
    listExportSchedules.mockResolvedValue([{ id: "aes_1" }]);
    const res = await call(makeHandler(), "GET", "/admin/audit-export/schedules");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ schedules: [{ id: "aes_1" }] });
    expect(listExportSchedules).toHaveBeenCalledWith({}, { projectId: "p1" });
  });

  it("maps schedule validation errors to 400 and success to 201", async () => {
    const handler = makeHandler();
    createExportSchedule.mockResolvedValueOnce({ error: "frequency is required" });
    const invalid = await call(handler, "POST", "/admin/audit-export/schedules", { name: "Weekly" });
    expect(invalid.status).toBe(400);

    const created = await call(handler, "POST", "/admin/audit-export/schedules", {
      name: "Weekly",
      frequency: "weekly",
      format: "csv",
    });
    expect(created.status).toBe(201);
    expect(createExportSchedule).toHaveBeenCalledWith({}, {
      projectId: "p1",
      name: "Weekly",
      frequency: "weekly",
      format: "csv",
      filterActor: undefined,
      filterAction: undefined,
      filterResource: undefined,
      filterSeverity: undefined,
      destinationType: undefined,
      destinationUrl: undefined,
      destinationConfig: undefined,
    });
  });

  it("toggles and deletes a schedule scoped to the project", async () => {
    const handler = makeHandler();
    await call(handler, "PATCH", "/admin/audit-export/schedules/aes_1", { enabled: false });
    expect(toggleExportSchedule).toHaveBeenCalledWith({}, {
      id: "aes_1",
      projectId: "p1",
      enabled: false,
    });

    await call(handler, "DELETE", "/admin/audit-export/schedules/aes_1");
    expect(deleteExportSchedule).toHaveBeenCalledWith({}, { id: "aes_1", projectId: "p1" });
  });

  it("validates the events limit and forwards filters", async () => {
    const handler = makeHandler();
    const invalid = await call(handler, "GET", "/admin/audit-export/events?limit=abc");
    expect(invalid.status).toBe(400);
    expect(queryFilteredAuditEvents).not.toHaveBeenCalled();

    queryFilteredAuditEvents.mockResolvedValue([{ id: "evt_1" }]);
    const res = await call(
      handler,
      "GET",
      "/admin/audit-export/events?startTime=2026-01-01&actor=u1&action=login&limit=10",
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ events: [{ id: "evt_1" }] });
    expect(queryFilteredAuditEvents).toHaveBeenCalledWith({}, {
      projectId: "p1",
      startTime: "2026-01-01",
      endTime: null,
      actor: "u1",
      action: "login",
      resourceType: null,
      severity: null,
      limit: 10,
    });
  });

  it("streams a csv export", async () => {
    const res = await call(makeHandler(), "GET", "/admin/audit-export/stream?format=csv");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain");
    expect(await res.text()).toContain("id,action");
    expect(streamExport).toHaveBeenCalledWith({}, expect.objectContaining({
      projectId: "p1",
      format: "csv",
    }));
  });

  it("validates run limits and exposes stats", async () => {
    const handler = makeHandler();
    expect((await call(handler, "GET", "/admin/audit-export/runs?limit=0")).status).toBe(400);

    getExportRuns.mockResolvedValue([{ id: "run_1" }]);
    const runs = await call(handler, "GET", "/admin/audit-export/runs?limit=5");
    expect(runs.status).toBe(200);
    expect(getExportRuns).toHaveBeenCalledWith({}, { projectId: "p1", limit: 5 });

    const stats = await call(handler, "GET", "/admin/audit-export/stats");
    expect(stats.status).toBe(200);
    expect(getAuditStats).toHaveBeenCalledWith({}, {
      projectId: "p1",
      startTime: null,
      endTime: null,
    });
  });
});
