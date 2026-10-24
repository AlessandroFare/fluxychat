/**
 * Fleet route happy paths + status mapping.
 * The lib is unit-tested on its own fake D1 (`fleet-tracking.test.js`) and the
 * GPS ingest happy paths already live in `verticals-http-contract.test.js` —
 * this file locks the rest of the HTTP layer: dispatch, vehicle-key vs JWT,
 * arg mapping and error → status codes.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthMatrixDeps } from "./auth-matrix-deps.js";
import { dispatchFleetTrackingRoutes } from "./fleet-tracking-http.js";
import * as fleet from "../lib/fleet-tracking.js";

vi.mock("../lib/fleet-tracking.js", () => ({
  parseGpsIngestBody: vi.fn(),
  parseRecorderTime: vi.fn(),
  parseVehicleInput: vi.fn(),
  parseTripInput: vi.fn(),
  parseGeofenceInput: vi.fn(),
  parseGeofencePatch: vi.fn(),
  parseDeliveryMatchInput: vi.fn(),
  authenticateFleetVehicle: vi.fn(),
  ingestGps: vi.fn(),
  listCurrentPositions: vi.fn(),
  getGpsHistory: vi.fn(),
  listVehicles: vi.fn(),
  createVehicle: vi.fn(),
  updateVehicle: vi.fn(),
  listTrips: vi.fn(),
  createTrip: vi.fn(),
  updateTripStatus: vi.fn(),
  listGeofences: vi.fn(),
  createGeofence: vi.fn(),
  updateGeofence: vi.fn(),
  deleteGeofence: vi.fn(),
  listGeofenceEvents: vi.fn(),
  findNearestDrivers: vi.fn(),
  matchDelivery: vi.fn(),
  routeCopilot: vi.fn(),
  predictDeliveryWindow: vi.fn(),
  dynamicPricing: vi.fn(),
}));

const auth = { userId: "u1", projectId: "p1", roles: ["member"] };

function deps(overrides = {}) {
  return createAuthMatrixDeps({
    verifyJwt: async () => auth,
    ...overrides,
  });
}

function request(path, { method = "GET", body, headers } = {}, h) {
  const init = { method, headers: { ...headers } };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const req = new Request(`http://127.0.0.1:8787${path}`, init);
  return dispatchFleetTrackingRoutes(req, new URL(req.url), h);
}

describe("fleet routes — dispatch & auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fleet.parseRecorderTime.mockImplementation((value, fallback) =>
      value == null || value === "" ? fallback : value,
    );
    fleet.authenticateFleetVehicle.mockResolvedValue(null);
  });

  it("returns null for non-fleet paths and unmatched fleet routes (auth first)", async () => {
    expect(await request("/rooms/room_1", {}, deps())).toBeNull();
    expect(await request("/fleet/unknown", {}, deps())).toBeNull();
    // Auth runs before route matching: an unauthenticated unknown path is 401.
    expect((await request("/fleet/unknown", {}, createAuthMatrixDeps())).status).toBe(401);
  });

  it("401s without credentials", async () => {
    const res = await request("/fleet/vehicles", {}, createAuthMatrixDeps());
    expect(res.status).toBe(401);
    await expect(res.text()).resolves.toBe("Unauthorized");
  });

  it("accepts a vehicle key on POST /fleet/gps only", async () => {
    fleet.authenticateFleetVehicle.mockResolvedValue({ id: "v_1", projectId: "p1" });
    fleet.parseGpsIngestBody.mockReturnValue({
      ok: true,
      data: { vehicleId: "v_1", lat: 45, lng: 9 },
    });
    fleet.ingestGps.mockResolvedValue({ ok: true, ts: 5, geofenceEvents: [] });
    const ok = await request(
      "/fleet/gps",
      { method: "POST", body: { lat: 45, lng: 9 }, headers: { Authorization: "Bearer fleet_key" } },
      deps(),
    );
    expect(ok.status).toBe(200);
    expect(fleet.authenticateFleetVehicle).toHaveBeenCalledWith(expect.anything(), "fleet_key");

    const forbidden = await request(
      "/fleet/vehicles",
      { headers: { Authorization: "Bearer fleet_key" } },
      deps(),
    );
    expect(forbidden.status).toBe(403);
    expect((await forbidden.json()).error).toBe("forbidden");
    expect(fleet.listVehicles).not.toHaveBeenCalled();
  });

  it("401s an unknown vehicle key", async () => {
    fleet.authenticateFleetVehicle.mockResolvedValue(null);
    const res = await request(
      "/fleet/gps",
      { method: "POST", body: { lat: 45, lng: 9 }, headers: { Authorization: "Bearer fleet_ghost" } },
      deps(),
    );
    expect(res.status).toBe(401);
    expect(fleet.ingestGps).not.toHaveBeenCalled();
  });
});

describe("fleet routes — gps ingest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fleet.authenticateFleetVehicle.mockResolvedValue(null);
  });

  it("POST /fleet/gps ingests one point and maps the limit headers", async () => {
    fleet.parseGpsIngestBody.mockReturnValue({ ok: true, data: { vehicleId: "v_1", lat: 45, lng: 9 } });
    fleet.ingestGps.mockResolvedValue({ ok: true, ts: 7, geofenceEvents: [] });
    const res = await request(
      "/fleet/gps",
      {
        method: "POST",
        body: { vehicleId: "v_1", lat: 45, lng: 9 },
        headers: { "X-Limit-User": "u9", "X-Limit-Device": "phone" },
      },
      deps(),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).ts).toBe(7);
    expect(fleet.parseGpsIngestBody).toHaveBeenCalledWith(
      { vehicleId: "v_1", lat: 45, lng: 9 },
      { user: "u9", device: "phone" },
    );
    expect(fleet.ingestGps).toHaveBeenCalledWith(expect.objectContaining({ DB: null }), "p1", {
      vehicleId: "v_1",
      lat: 45,
      lng: 9,
    });
  });

  it("a vehicle key forces its own vehicleId, ignoring a spoofed one", async () => {
    fleet.authenticateFleetVehicle.mockResolvedValue({ id: "v_1", projectId: "p1" });
    fleet.parseGpsIngestBody.mockReturnValue({
      ok: true,
      data: { vehicleId: "v_OTHER", lat: 45, lng: 9 },
    });
    fleet.ingestGps.mockResolvedValue({ ok: true, ts: 8, geofenceEvents: [] });
    await request(
      "/fleet/gps",
      { method: "POST", body: { vehicleId: "v_OTHER", lat: 45, lng: 9 }, headers: { Authorization: "Bearer fleet_key" } },
      deps(),
    );
    expect(fleet.ingestGps).toHaveBeenCalledWith(expect.anything(), "p1", {
      vehicleId: "v_1",
      lat: 45,
      lng: 9,
    });
  });

  it("handles arrays: batch response, skip_type, all-skipped 400", async () => {
    fleet.parseGpsIngestBody
      .mockReturnValueOnce({ ok: false, error: "skip_type", type: "lwt" })
      .mockReturnValueOnce({ ok: true, data: { vehicleId: "v_1", lat: 45, lng: 9 } })
      .mockReturnValueOnce({ ok: true, data: { vehicleId: "v_1", lat: 46, lng: 10 } });
    fleet.ingestGps.mockResolvedValue({ ok: true, ts: 9, geofenceEvents: [] });
    const batch = await request(
      "/fleet/gps",
      { method: "POST", body: [{ _type: "lwt" }, { lat: 45 }, { lat: 46 }] },
      deps(),
    );
    expect(batch.status).toBe(200);
    expect((await batch.json()).count).toBe(2);

    fleet.parseGpsIngestBody.mockReset();
    fleet.parseGpsIngestBody.mockReturnValue({ ok: false, error: "skip_type", type: "lwt" });
    const none = await request("/fleet/gps", { method: "POST", body: [{ _type: "lwt" }] }, deps());
    expect(none.status).toBe(400);
    expect((await none.json()).error).toBe("no_location");
  });

  it("400s a parse error and 429s a quota error with retryAfterSeconds", async () => {
    fleet.parseGpsIngestBody.mockReturnValueOnce({ ok: false, error: "invalid lat/lng" });
    const bad = await request("/fleet/gps", { method: "POST", body: { lat: "x" } }, deps());
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toBe("invalid lat/lng");

    fleet.parseGpsIngestBody.mockReturnValue({ ok: true, data: { vehicleId: "v_1", lat: 45, lng: 9 } });
    fleet.ingestGps.mockResolvedValueOnce({ ok: false, error: "quota_exceeded", retryAfterSeconds: 42 });
    const quota = await request("/fleet/gps", { method: "POST", body: { lat: 45, lng: 9 } }, deps());
    expect(quota.status).toBe(429);
    expect((await quota.json()).retryAfterSeconds).toBe(42);
  });
});

describe("fleet routes — positions & history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fleet.parseRecorderTime.mockImplementation((value, fallback) =>
      value == null || value === "" ? fallback : value,
    );
  });

  it("GET current/last resolves vehicleId and the device alias", async () => {
    fleet.listCurrentPositions.mockResolvedValue({ ok: true, vehicles: [{ id: "v_1" }] });
    const byVehicle = await request("/fleet/gps/current?vehicleId=v_1", {}, deps());
    expect(byVehicle.status).toBe(200);
    expect(fleet.listCurrentPositions).toHaveBeenCalledWith(expect.anything(), "p1", "v_1");

    const byDevice = await request("/fleet/gps/last?device=v_2", {}, deps());
    expect(byDevice.status).toBe(200);
    expect(fleet.listCurrentPositions).toHaveBeenLastCalledWith(expect.anything(), "p1", "v_2");
  });

  it("GET history requires vehicleId and maps from/to/limit", async () => {
    const missing = await request("/fleet/gps/history", {}, deps());
    expect(missing.status).toBe(400);
    expect((await missing.json()).error).toBe("vehicleId query param required");

    fleet.getGpsHistory.mockResolvedValue({ ok: true, points: [{ ts: 1 }] });
    const res = await request(
      "/fleet/gps/history?vehicleId=v_1&from=2026-01-01&to=2026-01-02&limit=50",
      {},
      deps(),
    );
    expect(res.status).toBe(200);
    expect(fleet.parseRecorderTime).toHaveBeenCalledWith("2026-01-01", expect.any(Number));
    expect(fleet.getGpsHistory).toHaveBeenCalledWith(
      expect.anything(),
      "p1",
      "v_1",
      "2026-01-01",
      "2026-01-02",
      "50",
    );

    fleet.getGpsHistory.mockResolvedValue({ ok: true, points: [] });
    const alias = await request("/fleet/gps/locations?vehicleId=v_1", {}, deps());
    expect(alias.status).toBe(200);
  });

  it("history falls back to the X-Limit-From/To headers", async () => {
    fleet.getGpsHistory.mockResolvedValue({ ok: true, points: [] });
    await request(
      "/fleet/gps/history?vehicleId=v_1",
      { headers: { "X-Limit-From": "1760000000", "X-Limit-To": "1760003600" } },
      deps(),
    );
    expect(fleet.parseRecorderTime).toHaveBeenCalledWith("1760000000", expect.any(Number));
    expect(fleet.getGpsHistory).toHaveBeenCalledWith(
      expect.anything(),
      "p1",
      "v_1",
      "1760000000",
      "1760003600",
      null,
    );
  });
});

describe("fleet routes — vehicles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET lists and POST creates with the parsed input (201)", async () => {
    fleet.listVehicles.mockResolvedValue({ ok: true, vehicles: [{ id: "v_1" }] });
    const list = await request("/fleet/vehicles", {}, deps());
    expect(list.status).toBe(200);
    expect((await list.json()).vehicles).toHaveLength(1);

    fleet.parseVehicleInput.mockReturnValueOnce({ ok: true, data: { name: "Van", plate: null, driverId: null } });
    fleet.createVehicle.mockResolvedValueOnce({ ok: true, vehicle: { id: "v_1", name: "Van" }, apiKey: "fleet_secret" });
    const created = await request("/fleet/vehicles", { method: "POST", body: { name: "Van" } }, deps());
    expect(created.status).toBe(201);
    expect((await created.json()).apiKey).toBe("fleet_secret");

    fleet.parseVehicleInput.mockReturnValueOnce({ ok: false, error: "name required (max 100 chars)" });
    const bad = await request("/fleet/vehicles", { method: "POST", body: {} }, deps());
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toBe("name required (max 100 chars)");
  });

  it("PATCH updates; missing body 400; lib refusal 400", async () => {
    fleet.updateVehicle.mockResolvedValueOnce({ ok: true });
    const ok = await request("/fleet/vehicles/v_1", { method: "PATCH", body: { status: "idle" } }, deps());
    expect(ok.status).toBe(200);
    expect(fleet.updateVehicle).toHaveBeenCalledWith(expect.anything(), "p1", "v_1", { status: "idle" });

    const noBody = await request("/fleet/vehicles/v_1", { method: "PATCH" }, deps());
    expect(noBody.status).toBe(400);

    fleet.updateVehicle.mockResolvedValueOnce({ ok: false, error: "no fields to update" });
    const refused = await request("/fleet/vehicles/v_1", { method: "PATCH", body: { nope: 1 } }, deps());
    expect(refused.status).toBe(400);
    expect((await refused.json()).error).toBe("no fields to update");
  });
});

describe("fleet routes — trips", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET maps the status filter", async () => {
    fleet.listTrips.mockResolvedValue({ ok: true, trips: [{ id: "t_1", status: "active" }] });
    const res = await request("/fleet/trips?status=active", {}, deps());
    expect(res.status).toBe(200);
    expect(fleet.listTrips).toHaveBeenCalledWith(expect.anything(), "p1", "active");

    await request("/fleet/trips", {}, deps());
    expect(fleet.listTrips).toHaveBeenLastCalledWith(expect.anything(), "p1", null);
  });

  it("POST creates (201) and 400s a parse error", async () => {
    fleet.parseTripInput.mockReturnValueOnce({ ok: true, data: { vehicleId: "v_1", pickupLat: 45, pickupLng: 9, dropoffLat: 46, dropoffLng: 10 } });
    fleet.createTrip.mockResolvedValueOnce({ ok: true, trip: { id: "t_1", vehicleId: "v_1", status: "pending", distanceMeters: 1000 } });
    const created = await request(
      "/fleet/trips",
      { method: "POST", body: { vehicleId: "v_1", pickupLat: 45, pickupLng: 9, dropoffLat: 46, dropoffLng: 10 } },
      deps(),
    );
    expect(created.status).toBe(201);

    fleet.parseTripInput.mockReturnValueOnce({ ok: false, error: "vehicleId required" });
    const bad = await request("/fleet/trips", { method: "POST", body: {} }, deps());
    expect(bad.status).toBe(400);
  });

  it("PATCH validates the status and passes lib status through", async () => {
    const invalid = await request("/fleet/trips/t_1", { method: "PATCH", body: { status: "nope" } }, deps());
    expect(invalid.status).toBe(400);
    const missing = await request("/fleet/trips/t_1", { method: "PATCH", body: {} }, deps());
    expect(missing.status).toBe(400);

    fleet.updateTripStatus.mockResolvedValueOnce({ ok: true, status: "completed" });
    const ok = await request("/fleet/trips/t_1", { method: "PATCH", body: { status: "completed" } }, deps());
    expect(ok.status).toBe(200);
    expect(fleet.updateTripStatus).toHaveBeenCalledWith(expect.anything(), "p1", "t_1", "completed");

    fleet.updateTripStatus.mockResolvedValueOnce({ ok: false, error: "trip_not_found", status: 404 });
    const notFound = await request("/fleet/trips/t_9", { method: "PATCH", body: { status: "active" } }, deps());
    expect(notFound.status).toBe(404);

    fleet.updateTripStatus.mockResolvedValueOnce({ ok: false, error: "invalid transition from completed to active" });
    const transition = await request("/fleet/trips/t_1", { method: "PATCH", body: { status: "active" } }, deps());
    expect(transition.status).toBe(400);
  });
});

describe("fleet routes — geofences & events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("geofence CRUD: list, create 201, patch, delete with status passthrough", async () => {
    fleet.listGeofences.mockResolvedValue({ ok: true, geofences: [{ id: "gf_1" }] });
    const list = await request("/fleet/geofences", {}, deps());
    expect(list.status).toBe(200);

    fleet.parseGeofenceInput.mockReturnValueOnce({ ok: true, data: { name: "Hub", lat: 45, lng: 9, radiusMeters: 100 } });
    fleet.createGeofence.mockResolvedValueOnce({ ok: true, geofence: { id: "gf_1", name: "Hub" } });
    const created = await request("/fleet/geofences", { method: "POST", body: { name: "Hub", lat: 45, lng: 9 } }, deps());
    expect(created.status).toBe(201);

    fleet.parseGeofencePatch.mockReturnValueOnce({ ok: false, error: "no fields to update" });
    const empty = await request("/fleet/geofences/gf_1", { method: "PATCH", body: {} }, deps());
    expect(empty.status).toBe(400);

    fleet.parseGeofencePatch.mockReturnValueOnce({ ok: true, data: { radiusMeters: 250 } });
    fleet.updateGeofence.mockResolvedValueOnce({ ok: true });
    const patched = await request("/fleet/geofences/gf_1", { method: "PATCH", body: { radiusMeters: 250 } }, deps());
    expect(patched.status).toBe(200);
    expect(fleet.updateGeofence).toHaveBeenCalledWith(expect.anything(), "p1", "gf_1", { radiusMeters: 250 });

    fleet.parseGeofencePatch.mockReturnValueOnce({ ok: true, data: { name: "x" } });
    fleet.updateGeofence.mockResolvedValueOnce({ ok: false, error: "geofence_not_found", status: 404 });
    const missing = await request("/fleet/geofences/gf_9", { method: "PATCH", body: { name: "x" } }, deps());
    expect(missing.status).toBe(404);

    fleet.deleteGeofence.mockResolvedValueOnce({ ok: true });
    expect((await request("/fleet/geofences/gf_1", { method: "DELETE" }, deps())).status).toBe(200);

    fleet.deleteGeofence.mockResolvedValueOnce({ ok: false, error: "geofence_not_found", status: 404 });
    expect((await request("/fleet/geofences/gf_9", { method: "DELETE" }, deps())).status).toBe(404);
  });

  it("geofence events map the filters", async () => {
    fleet.listGeofenceEvents.mockResolvedValue({ ok: true, events: [{ id: "gfe_1" }] });
    const res = await request("/fleet/geofence-events?vehicleId=v_1&geofenceId=gf_1&limit=20", {}, deps());
    expect(res.status).toBe(200);
    expect(fleet.listGeofenceEvents).toHaveBeenCalledWith(expect.anything(), "p1", {
      vehicleId: "v_1",
      geofenceId: "gf_1",
      limit: "20",
    });

    await request("/fleet/geofence-events", {}, deps());
    expect(fleet.listGeofenceEvents).toHaveBeenLastCalledWith(expect.anything(), "p1", {
      vehicleId: null,
      geofenceId: null,
      limit: null,
    });
  });
});

describe("fleet routes — delivery, copilot & pricing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("nearest 400s without lat/lng and defaults the limit to 5", async () => {
    const bad = await request("/fleet/delivery/nearest", { method: "POST", body: { lat: 45 } }, deps());
    expect(bad.status).toBe(400);

    fleet.findNearestDrivers.mockResolvedValue({ ok: true, drivers: [{ id: "v_1", distanceMeters: 800 }] });
    const res = await request("/fleet/delivery/nearest", { method: "POST", body: { lat: 45, lng: 9 } }, deps());
    expect(res.status).toBe(200);
    expect(fleet.findNearestDrivers).toHaveBeenCalledWith(expect.anything(), "p1", 45, 9, 5);

    await request("/fleet/delivery/nearest", { method: "POST", body: { lat: 45, lng: 9, limit: 2 } }, deps());
    expect(fleet.findNearestDrivers).toHaveBeenLastCalledWith(expect.anything(), "p1", 45, 9, 2);
  });

  it("match maps 404 no_available_drivers, 400 other refusals and 201 success", async () => {
    fleet.parseDeliveryMatchInput.mockReturnValueOnce({ ok: false, error: "invalid pickup coordinates" });
    expect((await request("/fleet/delivery/match", { method: "POST", body: {} }, deps())).status).toBe(400);

    fleet.parseDeliveryMatchInput.mockReturnValue({
      ok: true,
      data: { pickupLat: 45, pickupLng: 9, dropoffLat: 46, dropoffLng: 10, pickupAddress: "A", dropoffAddress: "B" },
    });
    fleet.matchDelivery.mockResolvedValueOnce({ ok: false, error: "no_available_drivers" });
    expect((await request("/fleet/delivery/match", { method: "POST", body: {} }, deps())).status).toBe(404);

    fleet.matchDelivery.mockResolvedValueOnce({ ok: false, error: "other" });
    expect((await request("/fleet/delivery/match", { method: "POST", body: {} }, deps())).status).toBe(400);

    fleet.matchDelivery.mockResolvedValueOnce({ ok: true, trip: { id: "t_1" }, driver: { id: "v_1", etaMinutes: 3 } });
    const created = await request("/fleet/delivery/match", { method: "POST", body: {} }, deps());
    expect(created.status).toBe(201);
    expect(fleet.matchDelivery).toHaveBeenLastCalledWith(expect.anything(), "p1", 45, 9, 46, 10, "A", "B");
  });

  it("copilot and predict validate coordinates, pricing takes no body", async () => {
    expect((await request("/fleet/route/copilot", { method: "POST", body: { pickupLat: 45 } }, deps())).status).toBe(400);
    fleet.routeCopilot.mockResolvedValueOnce({ ok: true, copilot: { advice: "go" } });
    const copilot = await request(
      "/fleet/route/copilot",
      { method: "POST", body: { pickupLat: 45, pickupLng: 9, dropoffLat: 46, dropoffLng: 10 } },
      deps(),
    );
    expect(copilot.status).toBe(200);
    expect(fleet.routeCopilot).toHaveBeenCalledWith(expect.anything(), "p1", 45, 9, 46, 10);

    expect((await request("/fleet/delivery/predict", { method: "POST", body: {} }, deps())).status).toBe(400);
    fleet.predictDeliveryWindow.mockResolvedValueOnce({ ok: true, window: { estimatedMinutes: 5 } });
    const predict = await request(
      "/fleet/delivery/predict",
      { method: "POST", body: { pickupLat: 45, pickupLng: 9, dropoffLat: 46, dropoffLng: 10 } },
      deps(),
    );
    expect(predict.status).toBe(200);
    expect(fleet.predictDeliveryWindow).toHaveBeenCalledWith(expect.anything(), "p1", 45, 9, 46, 10);

    fleet.dynamicPricing.mockResolvedValueOnce({ ok: true, pricing: { surgeMultiplier: 1 } });
    const pricing = await request("/fleet/pricing", { method: "POST" }, deps());
    expect(pricing.status).toBe(200);
    expect(fleet.dynamicPricing).toHaveBeenCalledWith(expect.anything(), "p1");
  });

  it("500s a lib throw and logs it", async () => {
    const logError = vi.fn();
    fleet.listVehicles.mockRejectedValueOnce(new Error("boom"));
    const res = await request("/fleet/vehicles", {}, deps({ extra: { logError } }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("internal_error");
    expect(logError).toHaveBeenCalledWith("fleet.unhandled", expect.any(Error), expect.anything());
  });
});
