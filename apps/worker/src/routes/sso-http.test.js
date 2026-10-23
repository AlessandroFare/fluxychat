import { beforeEach, describe, expect, it, vi } from "vitest";
import { json } from "../lib/http-json.js";
import { dispatchSSORoutes } from "./sso-http.js";

vi.mock("../lib/sso-saml.js", () => ({
  createConfiguration: vi.fn(),
  listConfigurations: vi.fn(),
  getConfiguration: vi.fn(),
  updateConfiguration: vi.fn(),
  deleteConfiguration: vi.fn(),
  listSessions: vi.fn(),
  getSession: vi.fn(),
  touchSession: vi.fn(),
  invalidateSession: vi.fn(),
  invalidateUserSessions: vi.fn(),
  listProvisionedUsers: vi.fn(),
  listAuditLog: vi.fn(),
  getSSOStats: vi.fn(),
}));

import {
  createConfiguration,
  deleteConfiguration,
  getConfiguration,
  getSSOStats,
  getSession,
  invalidateSession,
  invalidateUserSessions,
  listAuditLog,
  listConfigurations,
  listProvisionedUsers,
  listSessions,
  touchSession,
  updateConfiguration,
} from "../lib/sso-saml.js";

function makeHandler(overrides = {}) {
  return {
    env: { DB: {} },
    json,
    corsHeaders: {},
    verifyJwtAndGetContext: async () => ({ projectId: "p1", userId: "u1", roles: ["admin"] }),
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
  return dispatchSSORoutes(request, new URL(request.url), handler);
}

beforeEach(() => {
  vi.clearAllMocks();
  createConfiguration.mockResolvedValue({ id: "sc_new" });
  listConfigurations.mockResolvedValue({ configurations: [] });
  getConfiguration.mockResolvedValue(null);
  updateConfiguration.mockResolvedValue({ updated: true });
  deleteConfiguration.mockResolvedValue({ deleted: 1 });
  listSessions.mockResolvedValue({ sessions: [] });
  getSession.mockResolvedValue(null);
  touchSession.mockResolvedValue({ touched: true });
  invalidateSession.mockResolvedValue({ invalidated: true });
  invalidateUserSessions.mockResolvedValue({ invalidated: 2 });
  listProvisionedUsers.mockResolvedValue({ users: [] });
  listAuditLog.mockResolvedValue({ events: [] });
  getSSOStats.mockResolvedValue({ configurations: 0 });
});

describe("sso routes", () => {
  it("returns null for unrelated paths", async () => {
    const res = await call(makeHandler(), "GET", "/rooms");
    expect(res).toBeNull();
  });

  it("returns 401 without a JWT", async () => {
    const handler = makeHandler({ verifyJwtAndGetContext: async () => null });
    const res = await call(handler, "GET", "/api/sso/configurations");
    expect(res.status).toBe(401);
  });

  it("returns 403 for a member", async () => {
    const handler = makeHandler({
      verifyJwtAndGetContext: async () => ({ projectId: "p1", userId: "u1", roles: ["member"] }),
    });
    const res = await call(handler, "GET", "/api/sso/configurations");
    expect(res.status).toBe(403);
  });

  it("forces the authenticated project on configuration create", async () => {
    const res = await call(makeHandler(), "POST", "/api/sso/configurations", {
      name: "Okta",
      projectId: "attacker",
    });
    expect(res.status).toBe(200);
    expect(createConfiguration).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: "Okta", projectId: "p1" }),
    );
  });

  it("reads a configuration whose id contains an underscore", async () => {
    getConfiguration.mockResolvedValue({ id: "sc_abc123", name: "Okta" });
    const res = await call(makeHandler(), "GET", "/api/sso/configurations/sc_abc123");
    expect(res.status).toBe(200);
    expect(getConfiguration).toHaveBeenCalledWith(expect.anything(), {
      configId: "sc_abc123",
      projectId: "p1",
    });
  });

  it("returns 404 for a missing configuration", async () => {
    const res = await call(makeHandler(), "GET", "/api/sso/configurations/sc_missing");
    expect(res.status).toBe(404);
  });

  it("patches and deletes a configuration scoped to the project", async () => {
    const handler = makeHandler();
    const patch = await call(handler, "PATCH", "/api/sso/configurations/sc_abc123", { name: "Okta 2" });
    expect(patch.status).toBe(200);
    expect(updateConfiguration).toHaveBeenCalledWith(expect.anything(), {
      configId: "sc_abc123",
      name: "Okta 2",
      projectId: "p1",
    });

    const del = await call(handler, "DELETE", "/api/sso/configurations/sc_abc123");
    expect(del.status).toBe(200);
    expect(deleteConfiguration).toHaveBeenCalledWith(expect.anything(), {
      configId: "sc_abc123",
      projectId: "p1",
    });
  });

  it("lists sessions with query filters", async () => {
    await call(makeHandler(), "GET", "/api/sso/sessions?userId=u2&limit=10");
    expect(listSessions).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      userId: "u2",
      limit: 10,
    });
  });

  it("reads, touches and invalidates one session with an underscore id", async () => {
    const handler = makeHandler();
    getSession.mockResolvedValue({ id: "ss_abc123" });

    const read = await call(handler, "GET", "/api/sso/sessions/ss_abc123");
    expect(read.status).toBe(200);
    expect(getSession).toHaveBeenCalledWith(expect.anything(), {
      sessionId: "ss_abc123",
      projectId: "p1",
    });

    await call(handler, "POST", "/api/sso/sessions/ss_abc123/touch");
    expect(touchSession).toHaveBeenCalledWith(expect.anything(), {
      sessionId: "ss_abc123",
      projectId: "p1",
    });

    await call(handler, "POST", "/api/sso/sessions/ss_abc123/invalidate");
    expect(invalidateSession).toHaveBeenCalledWith(expect.anything(), {
      sessionId: "ss_abc123",
      projectId: "p1",
    });
  });

  it("forces the authenticated project on invalidate-all", async () => {
    await call(makeHandler(), "POST", "/api/sso/sessions/invalidate-all", {
      userId: "u2",
      projectId: "attacker",
    });
    expect(invalidateUserSessions).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: "u2", projectId: "p1" }),
    );
  });

  it("exposes JIT users, audit log and stats", async () => {
    const handler = makeHandler();
    await call(handler, "GET", "/api/sso/jit?limit=20");
    expect(listProvisionedUsers).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      limit: 20,
    });

    await call(handler, "GET", "/api/sso/audit?eventType=login&userId=u2&limit=5");
    expect(listAuditLog).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      eventType: "login",
      userId: "u2",
      limit: 5,
    });

    const stats = await call(handler, "GET", "/api/sso/stats");
    expect(stats.status).toBe(200);
    expect(getSSOStats).toHaveBeenCalledWith(expect.anything(), { projectId: "p1" });
  });
});
