import { describe, expect, it } from "vitest";
import { hashDeviceSecret } from "./device-secret.js";
import {
  authenticateFleetVehicle,
  FLEET_GPS_PER_VEHICLE_PER_MINUTE,
  haversine,
  ingestGps,
} from "./fleet-tracking.js";

describe("fleet-tracking production bars", () => {
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
});
