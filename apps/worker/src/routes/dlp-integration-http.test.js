import { beforeEach, describe, expect, it, vi } from "vitest";
import { json } from "../lib/http-json.js";
import { dispatchDlpIntegrationRoutes } from "./dlp-integration-http.js";

vi.mock("../lib/dlp-integrations.js", () => ({
  createIntegration: vi.fn(),
  updateIntegration: vi.fn(),
  deleteIntegration: vi.fn(),
  listIntegrations: vi.fn(),
  getIntegration: vi.fn(),
  scanWithIntegration: vi.fn(),
  getScanHistory: vi.fn(),
  getDlpIntegrationStats: vi.fn(),
}));

import {
  createIntegration,
  deleteIntegration,
  getDlpIntegrationStats,
  getScanHistory,
  listIntegrations,
  scanWithIntegration,
  updateIntegration,
} from "../lib/dlp-integrations.js";

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
  return dispatchDlpIntegrationRoutes(request, new URL(request.url), handler);
}

beforeEach(() => {
  vi.clearAllMocks();
  createIntegration.mockResolvedValue({ id: "dlp_1" });
  updateIntegration.mockResolvedValue({ updated: 1 });
  deleteIntegration.mockResolvedValue({ deleted: 1 });
  listIntegrations.mockResolvedValue([]);
  scanWithIntegration.mockResolvedValue({ scanned: true, matches: [] });
  getScanHistory.mockResolvedValue([]);
  getDlpIntegrationStats.mockResolvedValue({ scans: 0 });
});

describe("DLP integration routes", () => {
  it("returns 401 without a JWT and 403 for a member", async () => {
    const noAuth = makeHandler(["admin"], { verifyJwtAndGetContext: async () => null });
    expect((await call(noAuth, "GET", "/admin/dlp-integrations")).status).toBe(401);

    const member = makeHandler(["member"]);
    expect((await call(member, "GET", "/admin/dlp-integrations")).status).toBe(403);
  });

  it("returns null for unrelated paths once authenticated", async () => {
    expect(await call(makeHandler(), "GET", "/admin/dlp-integrations-other")).toBeNull();
  });

  it("lists integrations", async () => {
    listIntegrations.mockResolvedValue([{ id: "dlp_1" }]);
    const res = await call(makeHandler(), "GET", "/admin/dlp-integrations");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ integrations: [{ id: "dlp_1" }] });
    expect(listIntegrations).toHaveBeenCalledWith({}, { projectId: "p1" });
  });

  it("maps validation errors to 400 and success to 201", async () => {
    const handler = makeHandler();
    createIntegration.mockResolvedValueOnce({ error: "provider is required" });
    const invalid = await call(handler, "POST", "/admin/dlp-integrations", { name: "Nightfall" });
    expect(invalid.status).toBe(400);

    const created = await call(handler, "POST", "/admin/dlp-integrations", {
      name: "Nightfall",
      provider: "nightfall",
      endpointUrl: "https://api.example/scan",
      apiKey: "secret",
    });
    expect(created.status).toBe(201);
    expect(createIntegration).toHaveBeenCalledWith({}, {
      projectId: "p1",
      name: "Nightfall",
      provider: "nightfall",
      endpointUrl: "https://api.example/scan",
      apiKey: "secret",
      config: undefined,
    });
  });

  it("updates and deletes an integration scoped to the project", async () => {
    const handler = makeHandler();
    await call(handler, "PATCH", "/admin/dlp-integrations/dlp_1", { enabled: false });
    expect(updateIntegration).toHaveBeenCalledWith({}, {
      enabled: false,
      id: "dlp_1",
      projectId: "p1",
    });

    await call(handler, "DELETE", "/admin/dlp-integrations/dlp_1");
    expect(deleteIntegration).toHaveBeenCalledWith({}, { id: "dlp_1", projectId: "p1" });
  });

  it("scans content and maps scan errors", async () => {
    const handler = makeHandler();
    scanWithIntegration.mockResolvedValueOnce({ error: "content is required" });
    const invalid = await call(handler, "POST", "/admin/dlp-integrations/scan", {
      integrationId: "dlp_1",
    });
    expect(invalid.status).toBe(400);

    const res = await call(handler, "POST", "/admin/dlp-integrations/scan", {
      integrationId: "dlp_1",
      messageId: "m1",
      content: "4111 1111 1111 1111",
    });
    expect(res.status).toBe(200);
    expect(scanWithIntegration).toHaveBeenCalledWith({}, {
      integrationId: "dlp_1",
      projectId: "p1",
      messageId: "m1",
      roomId: undefined,
      content: "4111 1111 1111 1111",
      metadata: undefined,
    });
  });

  it("lists scans and stats", async () => {
    const handler = makeHandler();
    getScanHistory.mockResolvedValue([{ id: "scan_1" }]);
    const scans = await call(handler, "GET", "/admin/dlp-integrations/scans?integrationId=dlp_1&limit=10");
    expect(scans.status).toBe(200);
    expect(getScanHistory).toHaveBeenCalledWith({}, {
      projectId: "p1",
      integrationId: "dlp_1",
      limit: 10,
    });

    const stats = await call(handler, "GET", "/admin/dlp-integrations/stats");
    expect(stats.status).toBe(200);
    expect(getDlpIntegrationStats).toHaveBeenCalledWith({}, { projectId: "p1" });
  });
});
