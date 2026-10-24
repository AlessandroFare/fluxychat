import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { FluxyChatClient } from "./index";
import { createWorkerFluxyFleetClient } from "./worker-fluxy-fleet-client";

const baseUrl = "http://127.0.0.1:8787";

function client() {
  return createWorkerFluxyFleetClient(new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" }));
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function callUrl(mock: ReturnType<typeof vi.mocked<typeof fetch>>, i: number) {
  return String(mock.mock.calls[i]?.[0]);
}

function callInit(mock: ReturnType<typeof vi.mocked<typeof fetch>>, i: number) {
  return mock.mock.calls[i]?.[1] as RequestInit;
}

function callBody(mock: ReturnType<typeof vi.mocked<typeof fetch>>, i: number) {
  return JSON.parse(String((mock.mock.calls[i]?.[1] as RequestInit).body));
}

function callHeaders(mock: ReturnType<typeof vi.mocked<typeof fetch>>, i: number) {
  return (mock.mock.calls[i]?.[1] as RequestInit).headers as Record<string, string>;
}

describe("createWorkerFluxyFleetClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("ingests one location with the member JWT", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, ts: 1, geofenceEvents: [] }));
    const fleet = client();
    const result = await fleet.ingestGps({ vehicleId: "v_1", lat: 45.46, lng: 9.18 });
    expect(result.ok).toBe(true);
    expect(callUrl(fetchMock, 0)).toBe(`${baseUrl}/fleet/gps`);
    expect(callInit(fetchMock, 0).method).toBe("POST");
    expect(callBody(fetchMock, 0)).toEqual({ vehicleId: "v_1", lat: 45.46, lng: 9.18 });
    expect(callHeaders(fetchMock, 0).Authorization).toBe("Bearer jwt");
  });

  it("ingests with a vehicle key (device) instead of the JWT", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, ts: 2, geofenceEvents: [] }));
    const fleet = client();
    await fleet.ingestGps({ lat: 45, lng: 9 }, { vehicleKey: "fleet_key" });
    expect(callHeaders(fetchMock, 0).Authorization).toBe("Bearer fleet_key");
  });

  it("ingests a batch with OwnTracks limit headers", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, count: 2, results: [{ ok: true }, { ok: true }] }));
    const fleet = client();
    const result = await fleet.ingestGps(
      [
        { _type: "location", lat: 45, lon: 9, tst: 1760000000 },
        { _type: "location", lat: 46, lon: 10, tst: 1760000060 },
      ],
      { limit: { user: "u1", device: "phone" } },
    );
    expect(result.count).toBe(2);
    expect(callBody(fetchMock, 0)).toHaveLength(2);
    expect(callHeaders(fetchMock, 0)["X-Limit-User"]).toBe("u1");
    expect(callHeaders(fetchMock, 0)["X-Limit-Device"]).toBe("phone");
  });

  it("lists current positions with the vehicle filter", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ok: true, vehicles: [{ id: "v_1", name: "Van", status: "online", lat: 45, lng: 9 }] }),
    );
    const fleet = client();
    const positions = await fleet.listCurrentPositions({ vehicleId: "v_1" });
    expect(positions).toHaveLength(1);
    expect(callUrl(fetchMock, 0)).toContain("/fleet/gps/current?vehicleId=v_1");
  });

  it("lists GPS history with from/to/limit", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, points: [{ ts: 1, lat: 45, lng: 9, speed: 0, heading: 90 }] }));
    const fleet = client();
    const points = await fleet.listGpsHistory("v_1", { from: 1760000000000, to: "2026-10-16", limit: 50 });
    expect(points[0]?.heading).toBe(90);
    expect(callUrl(fetchMock, 0)).toContain("vehicleId=v_1&from=1760000000000&to=2026-10-16&limit=50");
  });

  it("lists, creates and updates vehicles", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, vehicles: [{ id: "v_1", name: "Van" }] }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, vehicle: { id: "v_2", name: "Truck" }, apiKey: "fleet_secret" }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    const fleet = client();
    const vehicles = await fleet.listVehicles();
    const created = await fleet.createVehicle({ name: "Truck", plate: "AB123" });
    await fleet.updateVehicle("v_2", { driverId: "u2" });
    expect(vehicles).toHaveLength(1);
    expect(created.apiKey).toBe("fleet_secret");
    expect(callInit(fetchMock, 1).method).toBe("POST");
    expect(callInit(fetchMock, 2).method).toBe("PATCH");
    expect(callUrl(fetchMock, 2)).toContain("/fleet/vehicles/v_2");
    expect(callBody(fetchMock, 2)).toEqual({ driverId: "u2" });
  });

  it("lists, creates and advances trips", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, trips: [{ id: "t_1", status: "pending" }] }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, trip: { id: "t_1", vehicleId: "v_1", status: "pending", distanceMeters: 4200 } }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, status: "active" }));
    const fleet = client();
    const trips = await fleet.listTrips({ status: "pending" });
    const trip = await fleet.createTrip({ vehicleId: "v_1", pickupLat: 45, pickupLng: 9, dropoffLat: 45.1, dropoffLng: 9.1 });
    const updated = await fleet.updateTripStatus("t_1", "active");
    expect(trips).toHaveLength(1);
    expect(trip.distanceMeters).toBe(4200);
    expect(updated.status).toBe("active");
    expect(callUrl(fetchMock, 0)).toContain("/fleet/trips?status=pending");
    expect(callBody(fetchMock, 2)).toEqual({ status: "active" });
  });

  it("manages geofences end to end", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, geofences: [{ id: "gf_1", name: "Hub", lat: 45, lng: 9, radiusMeters: 100 }] }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, geofence: { id: "gf_2", name: "Depot", lat: 45, lng: 9, radiusMeters: 250 } }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    const fleet = client();
    const list = await fleet.listGeofences();
    const created = await fleet.createGeofence({ name: "Depot", lat: 45, lng: 9, radiusMeters: 250 });
    await fleet.updateGeofence("gf_2", { radiusMeters: 300 });
    await fleet.deleteGeofence("gf_2");
    expect(list).toHaveLength(1);
    expect(created.id).toBe("gf_2");
    expect(callInit(fetchMock, 3).method).toBe("DELETE");
    expect(callUrl(fetchMock, 3)).toContain("/fleet/geofences/gf_2");
  });

  it("lists geofence events with filters", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, events: [{ id: "gfe_1", geofenceId: "gf_1", vehicleId: "v_1", eventType: "enter", occurredAt: "t" }] }));
    const fleet = client();
    const events = await fleet.listGeofenceEvents({ vehicleId: "v_1", geofenceId: "gf_1", limit: 20 });
    expect(events[0]?.eventType).toBe("enter");
    expect(callUrl(fetchMock, 0)).toContain("vehicleId=v_1&geofenceId=gf_1&limit=20");
  });

  it("finds nearest drivers and matches a delivery", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, drivers: [{ id: "v_1", name: "Van", lat: 45, lng: 9, distanceMeters: 800 }] }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, trip: { id: "t_2", vehicleId: "v_1", status: "pending" }, driver: { id: "v_1", name: "Van", plate: null, etaMinutes: 2, distanceMeters: 800 } }, 201));
    const fleet = client();
    const drivers = await fleet.findNearestDrivers(45, 9, 3);
    const match = await fleet.matchDelivery({ pickupLat: 45, pickupLng: 9, dropoffLat: 45.1, dropoffLng: 9.1 });
    expect(drivers[0]?.distanceMeters).toBe(800);
    expect(match.driver.etaMinutes).toBe(2);
    expect(callBody(fetchMock, 0)).toEqual({ lat: 45, lng: 9, limit: 3 });
    expect(callUrl(fetchMock, 1)).toContain("/fleet/delivery/match");
  });

  it("returns copilot, delivery window and pricing", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, copilot: { distanceMeters: 1200, estimatedDurationMin: 5, advice: "go", alternatives: [] } }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, window: { distanceKm: 1.2, estimatedMinutes: 5, confidencePercent: 88 } }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, pricing: { basePrice: 6, surgeMultiplier: 1.25, surgePrice: 7.5, currency: "EUR" } }));
    const fleet = client();
    const copilot = await fleet.routeCopilot({ pickupLat: 45, pickupLng: 9, dropoffLat: 45.1, dropoffLng: 9.1 });
    const window = await fleet.predictDeliveryWindow({ pickupLat: 45, pickupLng: 9, dropoffLat: 45.1, dropoffLng: 9.1 });
    const pricing = await fleet.dynamicPricing();
    expect(copilot.advice).toBe("go");
    expect(window.confidencePercent).toBe(88);
    expect(pricing.surgeMultiplier).toBe(1.25);
    // No body on pricing: the route reads demand from the fleet itself.
    expect(callInit(fetchMock, 2).body).toBeUndefined();
  });

  it("names the failing operation", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500));
    const fleet = client();
    await expect(fleet.listVehicles()).rejects.toThrow("listVehicles failed: 500");
  });
});
