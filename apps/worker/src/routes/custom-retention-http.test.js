import { beforeEach, describe, expect, it, vi } from "vitest";
import { json } from "../lib/http-json.js";
import { dispatchCustomRetentionRoutes } from "./custom-retention-http.js";

vi.mock("../lib/custom-retention.js", () => ({
  createRetentionPolicy: vi.fn(),
  updateRetentionPolicy: vi.fn(),
  deleteRetentionPolicy: vi.fn(),
  listRetentionPolicies: vi.fn(),
  getRetentionPolicy: vi.fn(),
  getEffectiveRetention: vi.fn(),
  getPurgeCandidates: vi.fn(),
  recordPurge: vi.fn(),
  getPurgeLogs: vi.fn(),
  getRetentionStats: vi.fn(),
}));

import {
  createRetentionPolicy,
  deleteRetentionPolicy,
  getEffectiveRetention,
  getPurgeCandidates,
  getPurgeLogs,
  getRetentionStats,
  listRetentionPolicies,
  updateRetentionPolicy,
} from "../lib/custom-retention.js";

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
  return dispatchCustomRetentionRoutes(request, new URL(request.url), handler);
}

beforeEach(() => {
  vi.clearAllMocks();
  createRetentionPolicy.mockResolvedValue({ id: "crp_1", created: true });
  updateRetentionPolicy.mockResolvedValue({ updated: 1 });
  deleteRetentionPolicy.mockResolvedValue({ deleted: 1 });
  listRetentionPolicies.mockResolvedValue([]);
  getEffectiveRetention.mockResolvedValue(null);
  getPurgeCandidates.mockResolvedValue([]);
  getPurgeLogs.mockResolvedValue([]);
  getRetentionStats.mockResolvedValue({ policies: 0 });
});

describe("custom retention routes", () => {
  it("returns 401 without a JWT and 403 for a member", async () => {
    const noAuth = makeHandler(["admin"], { verifyJwtAndGetContext: async () => null });
    expect((await call(noAuth, "GET", "/admin/retention/policies")).status).toBe(401);

    const member = makeHandler(["member"]);
    expect((await call(member, "GET", "/admin/retention/policies")).status).toBe(403);
  });

  it("returns null for unrelated paths once authenticated", async () => {
    expect(await call(makeHandler(), "GET", "/admin/retention-other")).toBeNull();
  });

  it("lists policies with filters", async () => {
    listRetentionPolicies.mockResolvedValue([{ id: "crp_1" }]);
    const res = await call(makeHandler(), "GET", "/admin/retention/policies?dataType=messages&roomId=r1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ policies: [{ id: "crp_1" }] });
    expect(listRetentionPolicies).toHaveBeenCalledWith({}, {
      projectId: "p1",
      dataType: "messages",
      roomId: "r1",
    });
  });

  it("maps policy validation errors to 400 and success to 201", async () => {
    const handler = makeHandler();
    createRetentionPolicy.mockResolvedValueOnce({ error: "name and dataType are required" });
    const invalid = await call(handler, "POST", "/admin/retention/policies", { name: "Keep" });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: "name and dataType are required" });

    const created = await call(handler, "POST", "/admin/retention/policies", {
      name: "Keep",
      dataType: "messages",
      retentionDays: 30,
    });
    expect(created.status).toBe(201);
    expect(createRetentionPolicy).toHaveBeenCalledWith({}, {
      projectId: "p1",
      name: "Keep",
      dataType: "messages",
      roomId: undefined,
      retentionDays: 30,
      autoPurge: undefined,
      archiveBeforeDelete: undefined,
      requireApproval: undefined,
    });
  });

  it("updates and deletes a policy scoped to the project", async () => {
    const handler = makeHandler();
    await call(handler, "PATCH", "/admin/retention/policies/crp_1", { retentionDays: 60 });
    expect(updateRetentionPolicy).toHaveBeenCalledWith({}, {
      retentionDays: 60,
      id: "crp_1",
      projectId: "p1",
    });

    await call(handler, "DELETE", "/admin/retention/policies/crp_1");
    expect(deleteRetentionPolicy).toHaveBeenCalledWith({}, { id: "crp_1", projectId: "p1" });
  });

  it("requires dataType for the effective policy and returns it", async () => {
    const handler = makeHandler();
    const invalid = await call(handler, "GET", "/admin/retention/effective");
    expect(invalid.status).toBe(400);
    expect(getEffectiveRetention).not.toHaveBeenCalled();

    getEffectiveRetention.mockResolvedValue({ retentionDays: 30 });
    const res = await call(handler, "GET", "/admin/retention/effective?dataType=messages&roomId=r1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ policy: { retentionDays: 30 } });
    expect(getEffectiveRetention).toHaveBeenCalledWith({}, {
      projectId: "p1",
      dataType: "messages",
      roomId: "r1",
    });
  });

  it("exposes purge candidates, logs and stats", async () => {
    const handler = makeHandler();
    const candidates = await call(handler, "GET", "/admin/retention/purge-candidates");
    expect(candidates.status).toBe(200);
    expect(getPurgeCandidates).toHaveBeenCalledWith({}, { projectId: "p1" });

    await call(handler, "GET", "/admin/retention/logs?limit=10");
    expect(getPurgeLogs).toHaveBeenCalledWith({}, { projectId: "p1", limit: 10 });

    const stats = await call(handler, "GET", "/admin/retention/stats");
    expect(stats.status).toBe(200);
    expect(getRetentionStats).toHaveBeenCalledWith({}, { projectId: "p1" });
  });
});
