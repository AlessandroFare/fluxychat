import { describe, expect, it } from "vitest";
import { hashDeviceSecret } from "./device-secret.js";
import {
  authenticateIoTDevice,
  ingestIoTReading,
  IOT_READINGS_PER_DAY,
  scoreIoTReadings,
} from "./fluxy-iot.js";

describe("scoreIoTReadings", () => {
  it("returns empty health when there are no samples", () => {
    const out = scoreIoTReadings([]);
    expect(out.sampleSize).toBe(0);
    expect(out.health).toBe(100);
    expect(out.alerts).toEqual([]);
  });

  it("flags a spike when the last reading is far from the mean", () => {
    const out = scoreIoTReadings([10, 10, 10, 10, 10, 40]);
    expect(out.sampleSize).toBe(6);
    expect(out.alerts).toContain("spike");
    expect(out.health).toBeLessThan(100);
  });

  it("flags a trend on a steep slope", () => {
    const out = scoreIoTReadings([1, 2, 3, 4, 5, 20]);
    expect(out.alerts.length).toBeGreaterThan(0);
    expect(out.slope).not.toBe(0);
  });
});

describe("IoT device token and quota", () => {
  it("authenticates a hashed iot_ key", async () => {
    const apiKey = "iot_" + "a".repeat(32);
    const hash = await hashDeviceSecret(apiKey);
    const env = {
      RATE_LIMIT_FALLBACK_ALLOW: "true",
      DB: {
        prepare(sql) {
          return {
            bind(...args) {
              return {
                async first() {
                  if (sql.includes("api_key_hash") && args[0] === hash) {
                    return { id: "dev_1", project_id: "p1", room_id: "iot:p1" };
                  }
                  return null;
                },
              };
            },
          };
        },
      },
    };
    const device = await authenticateIoTDevice(env, apiKey);
    expect(device).toEqual({ id: "dev_1", projectId: "p1", roomId: "iot:p1" });
    expect(await authenticateIoTDevice(env, "fc_wrong")).toBeNull();
  });

  it("rejects ingest after the daily quota", async () => {
    let remaining = 1;
    const env = {
      RATE_LIMIT_FALLBACK_ALLOW: "true",
      RATE_LIMIT_KV: {
        async get() {
          return remaining <= 0 ? String(IOT_READINGS_PER_DAY) : "0";
        },
        async put() {
          remaining -= 1;
        },
      },
      DB: {
        prepare() {
          return {
            bind() {
              return {
                async first() {
                  return { id: "dev_1", room_id: "r1" };
                },
                async run() {
                  return { meta: { changes: 1 } };
                },
              };
            },
          };
        },
      },
    };
    const first = await ingestIoTReading(env, { projectId: "p1" }, "dev_1", { sensor: "t", value: 1 });
    expect(first.ok).toBe(true);
    const second = await ingestIoTReading(env, { projectId: "p1" }, "dev_1", { sensor: "t", value: 2 });
    expect(second.ok).toBe(false);
    expect(second.error).toBe("quota_exceeded");
  });
});
