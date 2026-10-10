import { describe, expect, it } from "vitest";
import { hashDeviceSecret } from "./device-secret.js";
import {
  authenticateFleetVehicle,
  FLEET_GPS_PER_VEHICLE_PER_MINUTE,
  FLEET_ONLINE_TIMEOUT_MS,
  haversine,
  ingestGps,
  isFleetLastSeenOnline,
  listCurrentPositions,
  listGeofenceEvents,
  parseGeofencePatch,
  parseGpsIngestBody,
  parseRecorderTime,
  updateGeofence,
  deleteGeofence,
} from "./fleet-tracking.js";

describe("fleet-tracking production bars", () => {
  it("parses OwnTracks location JSON", () => {
    const parsed = parseGpsIngestBody({
      _type: "location",
      lat: 45.46,
      lon: 9.18,
      tst: 1_700_000_000,
      acc: 12,
      vel: 30,
      cog: 90,
      tid: "ab",
      batt: 80,
    });
    expect(parsed.ok).toBe(true);
    expect(parsed.data.lng).toBe(9.18);
    expect(parsed.data.vehicleId).toBe("ab");
    expect(parsed.data.accuracy).toBe(12);
    expect(parsed.data.speed).toBe(30);
    expect(parsed.data.ts).toBe(1_700_000_000_000);
  });

  it("maps X-Limit-User/Device to vehicleId", () => {
    const parsed = parseGpsIngestBody(
      { _type: "location", lat: 1, lon: 2, tst: 1_700_000_000 },
      { user: "ada", device: "phone" },
    );
    expect(parsed.data.vehicleId).toBe("ada:phone");
  });

  it("parses recorder from/to as ISO dates", () => {
    expect(parseRecorderTime("2015-09-01", 0)).toBe(Date.parse("2015-09-01T00:00:00.000Z"));
    expect(parseRecorderTime("1700000000", 0)).toBe(1_700_000_000_000);
  });

  it("skips non-location OwnTracks types", () => {
    const parsed = parseGpsIngestBody({ _type: "lwt", tst: 1 });
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("skip_type");
  });

  it("computes haversine distance", () => {
    expect(haversine(0, 0, 0, 0)).toBe(0);
    expect(haversine(45.46, 9.18, 45.47, 9.19)).toBeGreaterThan(1000);
  });

  it("authenticates a fleet_ device key", async () => {
    const apiKey = "fleet_" + "b".repeat(32);
    const hash = await hashDeviceSecret(apiKey);
    const env = {
      DB: {
        prepare(sql) {
          return {
            bind(...args) {
              return {
                async first() {
                  if (sql.includes("api_key_hash") && args[0] === hash) {
                    return { id: "v_1", fleet_id: "p1" };
                  }
                  return null;
                },
              };
            },
          };
        },
      },
    };
    expect(await authenticateFleetVehicle(env, apiKey)).toEqual({ id: "v_1", projectId: "p1" });
  });

  it("rate-limits GPS ingest per vehicle", async () => {
    const env = {
      RATE_LIMIT_FALLBACK_ALLOW: "true",
      RATE_LIMIT_KV: {
        async get() {
          return String(FLEET_GPS_PER_VEHICLE_PER_MINUTE);
        },
        async put() {},
      },
      DB: {
        prepare() {
          return {
            bind() {
              return {
                async run() {
                  return { meta: { changes: 1 } };
                },
                async all() {
                  return { results: [] };
                },
              };
            },
          };
        },
      },
    };
    const out = await ingestGps(env, "p1", { vehicleId: "v_1", lat: 1, lng: 2 });
    expect(out.ok).toBe(false);
    expect(out.error).toBe("quota_exceeded");
  });

  it("emits geofence enter once then exit on leave", async () => {
    const stored = [];
    const env = {
      RATE_LIMIT_KV: {
        async get() {
          return "0";
        },
        async put() {},
      },
      DB: {
        prepare(sql) {
          return {
            bind(...args) {
              return {
                async run() {
                  if (sql.includes("INSERT INTO fleet_geofence_events")) {
                    stored.push({
                      geofenceId: args[2],
                      vehicleId: args[3],
                      eventType: args[4],
                    });
                  }
                  return { meta: { changes: 1 } };
                },
                async all() {
                  if (sql.includes("FROM fleet_geofences")) {
                    return { results: [{ id: "gf_1", name: "yard", lat: 0, lng: 0, radius_meters: 500 }] };
                  }
                  return { results: [] };
                },
                async first() {
                  if (sql.includes("FROM fleet_geofence_events")) {
                    const last = [...stored]
                      .reverse()
                      .find((row) => row.geofenceId === args[1] && row.vehicleId === args[2]);
                    return last ? { event_type: last.eventType } : null;
                  }
                  return null;
                },
              };
            },
          };
        },
      },
    };
    const enter = await ingestGps(env, "p1", { vehicleId: "v_1", lat: 0, lng: 0 });
    expect(enter.geofenceEvents.map((e) => e.eventType)).toEqual(["enter"]);
    const stay = await ingestGps(env, "p1", { vehicleId: "v_1", lat: 0.0001, lng: 0 });
    expect(stay.geofenceEvents).toEqual([]);
    const exit = await ingestGps(env, "p1", { vehicleId: "v_1", lat: 10, lng: 10 });
    expect(exit.geofenceEvents.map((e) => e.eventType)).toEqual(["exit"]);
  });

  it("treats last-seen older than status timeout as offline", () => {
    expect(isFleetLastSeenOnline(new Date().toISOString())).toBe(true);
    expect(isFleetLastSeenOnline(new Date(Date.now() - FLEET_ONLINE_TIMEOUT_MS - 1).toISOString())).toBe(false);
    expect(isFleetLastSeenOnline(null)).toBe(false);
  });

  it("drops stale online vehicles from current positions", async () => {
    const updates = [];
    const env = {
      DB: {
        prepare(sql) {
          return {
            bind(...args) {
              return {
                async all() {
                  return {
                    results: [
                      {
                        id: "v_fresh",
                        name: "A",
                        plate: null,
                        status: "online",
                        last_lat: 1,
                        last_lng: 2,
                        last_heading: 0,
                        last_speed: 0,
                        last_seen_at: new Date().toISOString(),
                      },
                      {
                        id: "v_stale",
                        name: "B",
                        plate: null,
                        status: "online",
                        last_lat: 1,
                        last_lng: 2,
                        last_heading: 0,
                        last_speed: 0,
                        last_seen_at: new Date(Date.now() - FLEET_ONLINE_TIMEOUT_MS - 5000).toISOString(),
                      },
                    ],
                  };
                },
                async run() {
                  updates.push({ sql, args });
                  return { meta: { changes: 1 } };
                },
              };
            },
          };
        },
      },
    };
    const out = await listCurrentPositions(env, "p1");
    expect(out.vehicles.map((v) => v.id)).toEqual(["v_fresh"]);
    expect(updates[0]?.args).toEqual(["v_stale", "p1"]);
  });

  it("patches and deletes a geofence", async () => {
    expect(parseGeofencePatch({})).toEqual({ ok: false, error: "no fields to update" });
    const runs = [];
    const env = {
      DB: {
        prepare(sql) {
          return {
            bind(...args) {
              return {
                async run() {
                  runs.push({ sql, args });
                  return { meta: { changes: 1 } };
                },
              };
            },
          };
        },
      },
    };
    expect((await updateGeofence(env, "p1", "gf_1", { name: "dock" })).ok).toBe(true);
    expect((await deleteGeofence(env, "p1", "gf_1")).ok).toBe(true);
    expect(runs).toHaveLength(2);
  });

  it("lists stored geofence events", async () => {
    const env = {
      DB: {
        prepare() {
          return {
            bind() {
              return {
                async all() {
                  return {
                    results: [
                      {
                        id: "gfe_1",
                        geofence_id: "gf_1",
                        vehicle_id: "v_1",
                        event_type: "enter",
                        occurred_at: "2026-10-10T00:00:00.000Z",
                      },
                    ],
                  };
                },
              };
            },
          };
        },
      },
    };
    const out = await listGeofenceEvents(env, "p1", { vehicleId: "v_1" });
    expect(out.events[0]?.eventType).toBe("enter");
  });
});
