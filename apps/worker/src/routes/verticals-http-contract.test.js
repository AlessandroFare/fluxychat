/**
 * Phase 3 vertical HTTP contracts: collab, polls/edu, fleet, IoT, webhooks.
 */
import { describe, expect, it } from "vitest";
import { createAuthMatrixDeps, unauthorizedRequest } from "./auth-matrix-deps.js";
import { dispatchCollabRoutes } from "./collab-http.js";
import { dispatchPollsFormsRoutes } from "./polls-forms-http.js";
import { dispatchFleetTrackingRoutes } from "./fleet-tracking-http.js";
import { dispatchFluxyIoTRoutes } from "./fluxy-iot-http.js";
import { dispatchBreakoutRoomsRoutes } from "./breakout-rooms-http.js";
import { dispatchReportsWebhooksRoutes } from "./reports-webhooks-http.js";
import { FLEET_GPS_PER_VEHICLE_PER_MINUTE } from "../lib/fleet-tracking.js";

const memberJwt = async () => ({
  userId: "u1",
  projectId: "p1",
  roles: ["member"],
});

function bindsDb({ first = null, insertBinds = [] } = {}) {
  return {
    prepare(sql) {
      return {
        bind(...args) {
          if (String(sql).includes("INSERT INTO polls")) insertBinds.push(args);
          return {
            first: async () => {
              if (typeof first === "function") return first(sql, args);
              return first;
            },
            all: async () => ({ results: [] }),
            run: async () => ({ success: true, meta: { last_row_id: 1 } }),
          };
        },
      };
    },
  };
}

function deps(overrides = {}) {
  const db = overrides.db ?? bindsDb();
  return createAuthMatrixDeps({
    db,
    verifyJwt: overrides.verifyJwt ?? memberJwt,
    extra: {
      canAccessRoom: overrides.canAccessRoom ?? (async () => true),
      checkAndConsumeRateLimit:
        overrides.checkAndConsumeRateLimit ?? (async () => ({ allowed: true })),
      env: {
        DB: db,
        RATE_LIMIT_KV: overrides.kv,
        ATTACHMENTS: { put: async () => {}, get: async () => null },
        ...(overrides.env || {}),
      },
      ...overrides.extra,
    },
  });
}

function jsonReq(path, { method = "GET", body, headers = {} } = {}) {
  const req = unauthorizedRequest(path, { method, body });
  if (Object.keys(headers).length) {
    const init = {
      method,
      headers: { ...Object.fromEntries(req.headers.entries()), ...headers },
    };
    if (body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = typeof body === "string" ? body : JSON.stringify(body);
    }
    return new Request(req.url, init);
  }
  return req;
}

describe("collab HTTP", () => {
  it("GET /collab/files without JWT is 401", async () => {
    const req = jsonReq("/collab/files?roomId=room-1");
    const res = await dispatchCollabRoutes(req, new URL(req.url), createAuthMatrixDeps());
    expect(res.status).toBe(401);
  });

  it("POST /collab/files/upload without roomId is 400", async () => {
    const req = jsonReq("/collab/files/upload", { method: "POST" });
    const res = await dispatchCollabRoutes(req, new URL(req.url), deps());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("roomId required");
  });

  it("POST /collab/events without title is 400", async () => {
    const req = jsonReq("/collab/events?roomId=room-1", {
      method: "POST",
      body: { startTime: "2026-09-11T10:00:00Z", endTime: "2026-09-11T11:00:00Z" },
    });
    const res = await dispatchCollabRoutes(req, new URL(req.url), deps());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(String(body.error)).toMatch(/title/);
  });

  it("GET /collab/files with JWT returns a list", async () => {
    const req = jsonReq("/collab/files?roomId=room-1");
    const res = await dispatchCollabRoutes(req, new URL(req.url), deps());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.files)).toBe(true);
  });
});

describe("edu polls and breakouts", () => {
  it("POST /polls without JWT is 401", async () => {
    const req = jsonReq("/polls", {
      method: "POST",
      body: { roomId: "room-1", title: "Q", options: ["a"] },
    });
    const res = await dispatchPollsFormsRoutes(req, new URL(req.url), createAuthMatrixDeps());
    expect(res.status).toBe(401);
  });

  it("POST /polls without a title is 400", async () => {
    const req = jsonReq("/polls", {
      method: "POST",
      body: { roomId: "room-1", options: ["a", "b"] },
    });
    const res = await dispatchPollsFormsRoutes(req, new URL(req.url), deps());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("title_required");
  });

  it("POST /polls ignores spoofed createdBy and uses the JWT user", async () => {
    const insertBinds = [];
    const db = bindsDb({
      first: (sql) => (String(sql).includes("COUNT") ? { cnt: 0 } : null),
      insertBinds,
    });
    const req = jsonReq("/polls", {
      method: "POST",
      body: {
        roomId: "room-1",
        title: "Who?",
        options: ["A", "B"],
        createdBy: "attacker",
      },
    });
    const res = await dispatchPollsFormsRoutes(req, new URL(req.url), deps({ db }));
    expect(res.status).toBe(201);
    expect(insertBinds[0][3]).toBe("u1");
    expect(insertBinds[0][3]).not.toBe("attacker");
  });

  it("GET /rooms/:id/breakouts without JWT is 401", async () => {
    const req = jsonReq("/rooms/room-1/breakouts");
    const res = await dispatchBreakoutRoomsRoutes(req, new URL(req.url), createAuthMatrixDeps());
    expect(res.status).toBe(401);
  });

  it("GET /rooms/:id/breakouts without membership is 403", async () => {
    const req = jsonReq("/rooms/room-1/breakouts");
    const res = await dispatchBreakoutRoomsRoutes(
      req,
      new URL(req.url),
      deps({ canAccessRoom: async () => false }),
    );
    expect(res.status).toBe(403);
  });
});

describe("fleet GPS", () => {
  it("POST /fleet/gps without auth is 401", async () => {
    const req = jsonReq("/fleet/gps", {
      method: "POST",
      body: { vehicleId: "v_1", lat: 45, lng: 9 },
    });
    const res = await dispatchFleetTrackingRoutes(req, new URL(req.url), createAuthMatrixDeps());
    expect(res.status).toBe(401);
  });

  it("POST /fleet/gps with bad lat is 400", async () => {
    const req = jsonReq("/fleet/gps", {
      method: "POST",
      body: { vehicleId: "v_1", lat: 999, lng: 9 },
    });
    const res = await dispatchFleetTrackingRoutes(req, new URL(req.url), deps());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("lat/lng out of range");
  });

  it("POST /fleet/gps with a fleet_ key for a different vehicle is 403", async () => {
    const db = bindsDb({
      first: (sql) =>
        String(sql).includes("api_key_hash") ? { id: "v_1", fleet_id: "p1" } : null,
    });
    const req = jsonReq("/fleet/gps", {
      method: "POST",
      body: { vehicleId: "v_OTHER", lat: 45, lng: 9 },
      headers: { Authorization: "Bearer fleet_" + "b".repeat(32) },
    });
    const res = await dispatchFleetTrackingRoutes(req, new URL(req.url), deps({ db }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("vehicle_mismatch");
  });

  it("POST /fleet/gps over per-vehicle quota is 429", async () => {
    const kv = {
      get: async () => String(FLEET_GPS_PER_VEHICLE_PER_MINUTE),
      put: async () => {},
    };
    const req = jsonReq("/fleet/gps", {
      method: "POST",
      body: { vehicleId: "v_1", lat: 45, lng: 9 },
    });
    const res = await dispatchFleetTrackingRoutes(req, new URL(req.url), deps({ kv }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("quota_exceeded");
  });
});

describe("IoT ingest", () => {
  it("POST /iot/devices without JWT is 401", async () => {
    const req = jsonReq("/iot/devices", { method: "POST", body: { name: "pump" } });
    const res = await dispatchFluxyIoTRoutes(req, new URL(req.url), createAuthMatrixDeps());
    expect(res.status).toBe(401);
  });

  it("POST /iot/devices/:id/readings with an iot_ key for another device is 401", async () => {
    const db = bindsDb({
      first: (sql) =>
        String(sql).includes("api_key_hash")
          ? { id: "dev_real", project_id: "p1", room_id: "iot:p1" }
          : null,
    });
    const req = jsonReq("/iot/devices/dev_OTHER/readings", {
      method: "POST",
      body: { sensor: "temp", value: 12 },
      headers: { Authorization: "Bearer iot_" + "a".repeat(32) },
    });
    const res = await dispatchFluxyIoTRoutes(req, new URL(req.url), deps({ db }));
    expect(res.status).toBe(401);
  });
});

describe("webhooks", () => {
  it("POST /webhooks/register with an invalid body is 400", async () => {
    const req = jsonReq("/webhooks/register", { method: "POST", body: { url: "not-a-url" } });
    const res = await dispatchReportsWebhooksRoutes(req, new URL(req.url), deps());
    expect(res.status).toBe(400);
  });

  it("POST /webhooks/register without JWT is 401", async () => {
    const req = jsonReq("/webhooks/register", {
      method: "POST",
      body: { url: "https://example.com/hook", eventTypes: ["message.created"] },
    });
    const res = await dispatchReportsWebhooksRoutes(req, new URL(req.url), createAuthMatrixDeps());
    expect(res.status).toBe(401);
  });

  it("POST /webhooks/register to a private URL is 400 ssrf_blocked", async () => {
    const req = jsonReq("/webhooks/register", {
      method: "POST",
      body: { url: "http://127.0.0.1/hook", eventTypes: ["message.created"] },
    });
    const res = await dispatchReportsWebhooksRoutes(req, new URL(req.url), deps());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("ssrf_blocked");
  });
});
