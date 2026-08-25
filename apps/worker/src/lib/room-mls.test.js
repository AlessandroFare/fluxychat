import { describe, expect, it } from "vitest";
import { addRoomMlsDevice, getRoomMlsGroup, rotateRoomMlsEpoch, upsertRoomMlsGroup } from "./room-mls.js";

function makeRows() {
  return new Map();
}

function makeDb(rows) {
  return {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async first() {
              if (sql.includes("FROM room_mls_groups")) {
                const [projectId, roomId] = params;
                return rows.get(`${projectId}:${roomId}`) ?? null;
              }
              return null;
            },
            async run() {
              if (sql.includes("INSERT INTO room_mls_groups")) {
                rows.set(`${params[0]}:${params[1]}`, {
                  project_id: params[0],
                  room_id: params[1],
                  group_id: params[2],
                  epoch: params[3],
                  cipher_suite: params[4],
                  max_devices: params[5],
                  devices_json: params[6],
                  updated_at: params[7],
                });
              }
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
}

function makeEnv() {
  const rows = makeRows();
  return { DB: makeDb(rows), rows };
}

describe("room-mls — coordination registry (no crypto)", () => {
  it("creates registry row for room", async () => {
    const env = makeEnv();
    const auth = { projectId: "p1", userId: "admin" };
    const result = await upsertRoomMlsGroup(env, auth, "room-1", {});
    expect(result.groupId).toMatch(/^grp_/);
    expect(result.epoch).toBe(0);
    expect(result.cipherSuite).toBe("AES-256-GCM/HKDF-SHA256");
  });

  it("adds devices up to maxDevices", async () => {
    const env = makeEnv();
    const auth = { projectId: "p1", userId: "admin" };
    await upsertRoomMlsGroup(env, auth, "room-1", { maxDevices: 2 });
    await addRoomMlsDevice(env, auth, "room-1", { deviceId: "d1", publicKey: "pk1", signatureKey: "sk1" });
    const second = await addRoomMlsDevice(env, auth, "room-1", { deviceId: "d2", publicKey: "pk2", signatureKey: "sk2" });
    expect(second.devices).toHaveLength(2);
    const third = await addRoomMlsDevice(env, auth, "room-1", { deviceId: "d3", publicKey: "pk3", signatureKey: "sk3" });
    expect(third.devices).toHaveLength(2);
  });

  it("rotates epoch", async () => {
    const env = makeEnv();
    const auth = { projectId: "p1", userId: "admin" };
    await upsertRoomMlsGroup(env, auth, "room-1", {});
    const rotated = await rotateRoomMlsEpoch(env, auth, "room-1");
    expect(rotated.epoch).toBe(1);
    const fetched = await getRoomMlsGroup(env, auth, "room-1");
    expect(fetched.epoch).toBe(1);
  });

  it("uses the real cipher suite constant, never MLS", async () => {
    const env = makeEnv();
    const auth = { projectId: "p1", userId: "admin" };
    const result = await upsertRoomMlsGroup(env, auth, "room-1", {});
    expect(result.cipherSuite).toBe("AES-256-GCM/HKDF-SHA256");
  });
});