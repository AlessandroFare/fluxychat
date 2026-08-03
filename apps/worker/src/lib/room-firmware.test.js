import { describe, it, expect, vi } from "vitest";
import {
  runRoomFirmwareHook,
  upsertRoomFirmware,
} from "./room-firmware.js";

vi.mock("./rate-limit.js", () => ({
  checkAndConsumeRateLimit: vi.fn(async () => ({ allowed: true })),
}));

function makeEnv(firmwareRow = null) {
  const audits = [];
  let storedRow = firmwareRow;
  return {
    env: {
      DB: {
        prepare: vi.fn((sql) => ({
          bind: vi.fn((...args) => ({
            first: vi.fn(async () => {
              if (sql.includes("FROM room_firmware")) return storedRow;
              return null;
            }),
            run: vi.fn(async () => {
              if (sql.includes("INSERT INTO room_firmware_audit")) audits.push(args);
              if (sql.includes("INSERT INTO room_firmware")) {
                storedRow = {
                  id: args[0],
                  project_id: args[1],
                  room_id: args[2],
                  version: args[3],
                  module_type: args[4],
                  capabilities_json: args[5],
                  config_json: args[6],
                  wasm_r2_key: null,
                  wasm_module_hash: null,
                  enabled: args[7],
                  created_by: args[8],
                  created_at: args[9],
                  updated_at: args[10],
                };
              }
              return {};
            }),
            all: vi.fn(async () => ({ results: [] })),
          })),
        })),
      },
    },
    audits,
  };
}

describe("room-firmware", () => {
  it("passes when firmware disabled", async () => {
    const { env } = makeEnv(null);
    const result = await runRoomFirmwareHook(env, {
      projectId: "p1",
      roomId: "r1",
      userId: "u1",
      eventType: "message.create",
      event: { content: "hello" },
    });
    expect(result.action).toBe("pass");
  });

  it("vetoes PII when pii_veto enabled", async () => {
    const { env, audits } = makeEnv({
      id: "fw1",
      project_id: "p1",
      room_id: "r1",
      version: 1,
      module_type: "builtin",
      capabilities_json: "[]",
      config_json: JSON.stringify({ modules: [{ id: "pii_veto", enabled: true }] }),
      enabled: 1,
    });
    const result = await runRoomFirmwareHook(env, {
      projectId: "p1",
      roomId: "r1",
      userId: "u1",
      eventType: "message.create",
      event: { content: "SSN 123-45-6789" },
    });
    expect(result.action).toBe("veto");
    expect(result.reason).toContain("pii");
    expect(audits.length).toBeGreaterThan(0);
  });

  it("vetoes denylist terms", async () => {
    const { env } = makeEnv({
      id: "fw1",
      project_id: "p1",
      room_id: "r1",
      version: 1,
      module_type: "builtin",
      capabilities_json: "[]",
      config_json: JSON.stringify({
        modules: [{ id: "denylist", enabled: true, patterns: ["confidential"] }],
      }),
      enabled: 1,
    });
    const result = await runRoomFirmwareHook(env, {
      projectId: "p1",
      roomId: "r1",
      userId: "u1",
      eventType: "message.create",
      event: { content: "This is CONFIDENTIAL data" },
    });
    expect(result.action).toBe("veto");
  });

  it("upserts firmware config", async () => {
    const { env } = makeEnv(null);
    const fw = await upsertRoomFirmware(env, {
      projectId: "p1",
      roomId: "r1",
      userId: "admin",
      patch: { enabled: true, config: { modules: [{ id: "pii_veto", enabled: true }] } },
    });
    expect(fw?.enabled).toBe(true);
  });
});
