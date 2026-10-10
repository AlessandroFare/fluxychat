import { describe, expect, it } from "vitest";
import { hashDeviceSecret } from "./device-secret.js";
import {
  authenticateIoTDevice,
  compareIoTCondition,
  fireIoTRules,
  deleteIoTReadings,
  getIoTDevice,
  ingestIoTReading,
  IOT_READINGS_PER_DAY,
  listIoTReadings,
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

  it("merges reported shadow keys across sensors", async () => {
    const reported = { humidity: 40 };
    let shadowJson = null;
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
              if (sql.includes("UPDATE iot_device_shadows")) shadowJson = args[0];
              return {
                async first() {
                  if (sql.includes("FROM iot_devices")) return { id: "dev_1", room_id: null };
                  if (sql.includes("reported_json")) return { reported_json: JSON.stringify(reported) };
                  return null;
                },
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
    const out = await ingestIoTReading(env, { projectId: "p1" }, "dev_1", { sensor: "temp", value: 21 });
    expect(out.ok).toBe(true);
    const merged = JSON.parse(shadowJson);
    expect(merged.humidity).toBe(40);
    expect(merged.temp).toBe(21);
  });

  it("lists stored timeseries readings", async () => {
    const env = {
      DB: {
        prepare(sql) {
          return {
            bind() {
              return {
                async first() {
                  return sql.includes("FROM iot_devices") ? { id: "dev_1" } : null;
                },
                async all() {
                  return {
                    results: [
                      { id: "rd_1", device_id: "dev_1", sensor: "temp", value: 21, unit: "C", recorded_at: "t" },
                    ],
                  };
                },
              };
            },
          };
        },
      },
    };
    const out = await listIoTReadings(env, { projectId: "p1" }, "dev_1", { sensor: "temp" });
    expect(out.readings[0]?.value).toBe(21);
  });

  it("evaluates rule operators and inserts an alarm", async () => {
    expect(compareIoTCondition(21, ">", 20)).toBe(true);
    expect(compareIoTCondition(19, ">", 20)).toBe(false);
    const inserts = [];
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
                        id: "rule_1",
                        name: "hot",
                        device_id: null,
                        condition_json: JSON.stringify({ sensor: "temp", operator: ">", value: 20 }),
                        action_json: "{}",
                        enabled: 1,
                      },
                    ],
                  };
                },
                async run() {
                  inserts.push({ sql, args });
                  return { meta: { changes: 1 } };
                },
              };
            },
          };
        },
      },
    };
    const alarms = await fireIoTRules(env, "p1", "dev_1", "temp", 22);
    expect(alarms).toHaveLength(1);
    expect(inserts[0]?.sql).toContain("iot_alarms");
  });

  it("gets a device and deletes timeseries", async () => {
    const env = {
      DB: {
        prepare(sql) {
          return {
            bind() {
              return {
                async first() {
                  if (sql.includes("FROM iot_devices")) {
                    return {
                      id: "dev_1",
                      name: "pump",
                      type: "sensor",
                      fleet_id: "default",
                      room_id: "iot:p1",
                      status: "online",
                      firmware_version: "1.0.0",
                      last_seen: null,
                      metadata_json: null,
                      location_json: null,
                    };
                  }
                  return null;
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
    const got = await getIoTDevice(env, { projectId: "p1" }, "dev_1");
    expect(got.device.name).toBe("pump");
    expect((await deleteIoTReadings(env, { projectId: "p1" }, "dev_1", { sensor: "temp" })).ok).toBe(true);
  });
});
