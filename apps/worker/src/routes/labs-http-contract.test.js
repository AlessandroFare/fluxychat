/**
 * Phase 5 labs (minimum): 401/403 + one 400 or empty happy path.
 * HIPAA is a BAA tracker, not a certification claim.
 */
import { describe, expect, it } from "vitest";
import { createAuthMatrixDeps, unauthorizedRequest } from "./auth-matrix-deps.js";
import { dispatchHIPAARoutes } from "./hipaa-http.js";
import { dispatchDlpIntegrationRoutes } from "./dlp-integration-http.js";
import { dispatchLiveStreamingRoutes } from "./live-streaming-http.js";
import { dispatchFluxyGameRoutes } from "./fluxy-game-http.js";
import { dispatchDigitalTwinRoutes } from "./digital-twin-http.js";
import { dispatchMarketplaceRoutes } from "./marketplace-http.js";
import { dispatchWidgetBuilderRoutes } from "./widget-builder-http.js";
import { dispatchMcpRoutes } from "./mcp-http.js";
import { dispatchBridgeRoutes } from "./bridge-http.js";
import { dispatchTelephonyHandoffRoutes } from "./telephony-handoff-http.js";
import { dispatchTruthMarketRoutes } from "./truth-market-http.js";
import { dispatchEventsRoutes } from "./events-http.js";

const memberJwt = async () => ({
  userId: "u1",
  projectId: "p1",
  roles: ["member"],
});

const adminJwt = async () => ({
  userId: "u1",
  projectId: "p1",
  roles: ["owner"],
});

function emptyDb() {
  const stmt = {
    bind() {
      return stmt;
    },
    all: async () => ({ results: [] }),
    first: async () => null,
    run: async () => ({ success: true, meta: { changes: 1, last_row_id: 1 } }),
  };
  return { prepare() { return stmt; } };
}

function deps({ admin = false, member = false } = {}) {
  const db = emptyDb();
  return createAuthMatrixDeps({
    db,
    verifyJwt: admin ? adminJwt : member ? memberJwt : undefined,
    extra: { env: { DB: db } },
  });
}

function req(path, { method = "GET", body } = {}) {
  return unauthorizedRequest(path, { method, body });
}

describe("HIPAA BAA tracker (not a certification)", () => {
  it("GET /api/hipaa/baa without JWT is 401", async () => {
    const request = req("/api/hipaa/baa");
    const res = await dispatchHIPAARoutes(request, new URL(request.url), deps());
    expect(res.status).toBe(401);
  });

  it("GET /api/hipaa/baa as a member is 403", async () => {
    const request = req("/api/hipaa/baa");
    const res = await dispatchHIPAARoutes(request, new URL(request.url), deps({ member: true }));
    expect(res.status).toBe(403);
  });

  it("GET /api/hipaa/baa as admin lists records, not a HIPAA stamp", async () => {
    const request = req("/api/hipaa/baa");
    const res = await dispatchHIPAARoutes(request, new URL(request.url), deps({ admin: true }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/HIPAA certified|HIPAA compliant/i);
  });
});

describe("DLP integrations", () => {
  it("GET /admin/dlp-integrations without JWT is 401", async () => {
    const request = req("/admin/dlp-integrations");
    const res = await dispatchDlpIntegrationRoutes(request, new URL(request.url), deps());
    expect(res.status).toBe(401);
  });

  it("POST /admin/dlp-integrations without name is 400", async () => {
    const request = req("/admin/dlp-integrations", { method: "POST", body: {} });
    const res = await dispatchDlpIntegrationRoutes(request, new URL(request.url), deps({ admin: true }));
    expect(res.status).toBe(400);
  });
});

describe("live stream events", () => {
  it("GET /api/live/events without JWT is 401", async () => {
    const request = req("/api/live/events");
    const res = await dispatchLiveStreamingRoutes(request, new URL(request.url), deps());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("unauthorized");
  });

  it("POST /api/live/events without a title is 400", async () => {
    const request = req("/api/live/events", { method: "POST", body: { roomId: "room-1" } });
    const res = await dispatchLiveStreamingRoutes(request, new URL(request.url), deps({ member: true }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("title required");
  });
});

describe("game / spatial / truth / events / telephony", () => {
  it("GET /games/leaderboard without JWT is 401", async () => {
    const request = req("/games/leaderboard");
    const res = await dispatchFluxyGameRoutes(request, new URL(request.url), deps());
    expect(res.status).toBe(401);
  });

  it("GET /games/leaderboard with JWT returns an empty board", async () => {
    const request = req("/games/leaderboard");
    const res = await dispatchFluxyGameRoutes(request, new URL(request.url), deps({ member: true }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.leaderboard).toEqual([]);
  });

  it("POST /spatial/scenes without JWT is 401", async () => {
    const request = req("/spatial/scenes", { method: "POST", body: { name: "lab" } });
    const res = await dispatchDigitalTwinRoutes(request, new URL(request.url), deps());
    expect(res.status).toBe(401);
  });

  it("POST /spatial/scenes without a name is 400", async () => {
    const request = req("/spatial/scenes", { method: "POST", body: {} });
    const res = await dispatchDigitalTwinRoutes(request, new URL(request.url), deps({ member: true }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("name_required");
  });

  it("POST /spatial/scenes for a room you do not belong to is 403", async () => {
    const request = req("/spatial/scenes", {
      method: "POST",
      body: { name: "lab", roomId: "room-1" },
    });
    const res = await dispatchDigitalTwinRoutes(request, new URL(request.url), deps({ member: true }));
    expect(res.status).toBe(403);
  });

  it("GET /admin/truth-market/credits without JWT is 401", async () => {
    const request = req("/admin/truth-market/credits");
    const res = await dispatchTruthMarketRoutes(request, new URL(request.url), deps());
    expect(res.status).toBe(401);
  });

  it("POST /events without JWT is 401", async () => {
    const request = req("/events", { method: "POST", body: { name: "x", roomIds: ["room-1"] } });
    const res = await dispatchEventsRoutes(request, new URL(request.url), deps());
    expect(res.status).toBe(401);
  });

  it("POST /integrations/telephony/handoff without JWT is 401", async () => {
    const request = req("/integrations/telephony/handoff", { method: "POST", body: { roomId: "room-1" } });
    const res = await dispatchTelephonyHandoffRoutes(request, new URL(request.url), deps());
    expect(res.status).toBe(401);
  });

  it("POST /integrations/telephony/handoff without roomId is 400", async () => {
    const request = req("/integrations/telephony/handoff", { method: "POST", body: {} });
    const res = await dispatchTelephonyHandoffRoutes(request, new URL(request.url), deps({ member: true }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("roomId required");
  });
});

describe("marketplace / widgets / bridges / MCP", () => {
  it("GET /marketplace/agents is public and returns a list", async () => {
    const request = req("/marketplace/agents");
    const res = await dispatchMarketplaceRoutes(request, new URL(request.url), deps());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.agents)).toBe(true);
  });

  it("GET /admin/marketplace/agents without JWT is 401", async () => {
    const request = req("/admin/marketplace/agents");
    const res = await dispatchMarketplaceRoutes(request, new URL(request.url), deps());
    expect(res.status).toBe(401);
  });

  it("GET /admin/marketplace/agents as a member is 403", async () => {
    const request = req("/admin/marketplace/agents");
    const res = await dispatchMarketplaceRoutes(request, new URL(request.url), deps({ member: true }));
    expect(res.status).toBe(403);
  });

  it("GET /admin/widgets without JWT is 401", async () => {
    const request = req("/admin/widgets");
    const res = await dispatchWidgetBuilderRoutes(request, new URL(request.url), deps());
    expect(res.status).toBe(401);
  });

  it("POST /admin/widgets without name/slug is 400", async () => {
    const request = req("/admin/widgets", { method: "POST", body: {} });
    const res = await dispatchWidgetBuilderRoutes(request, new URL(request.url), deps({ admin: true }));
    expect(res.status).toBe(400);
  });

  it("GET /admin/bridges without JWT is 401", async () => {
    const request = req("/admin/bridges");
    const res = await dispatchBridgeRoutes(request, new URL(request.url), deps());
    expect(res.status).toBe(401);
  });

  it("POST /mcp without JWT is 401 JSON-RPC", async () => {
    const request = req("/mcp", {
      method: "POST",
      body: { jsonrpc: "2.0", method: "initialize", id: 1 },
    });
    const res = await dispatchMcpRoutes(request, new URL(request.url), deps());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.message).toBe("Unauthorized");
  });
});
