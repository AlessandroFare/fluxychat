import { describe, expect, it } from "vitest";
import { addRoomMlsDevice, getRoomMlsGroup, rotateRoomMlsEpoch, upsertRoomMlsGroup } from "./room-mls.js";

function mlsEnv() {
  const rows = new Map();
  return {
    DB: {
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
    },
    rows,
  };
}

describe("room-mls", () => {
  it("creates MLS group registry for room", async () => {
    const env = mlsEnv();
    const auth = { projectId: "p1", userId: "admin" };
    const result = await upsertRoomMlsGroup(env, auth, "room-1", {});
    expect(result.ok).toBe(true);
    expect(result.group?.groupId).toMatch(/^mls_/);
    expect(result.group?.epoch).toBe(0);
  });

  it("adds device up to max_devices", async () => {
    const env = mlsEnv();
    const auth = { projectId: "p1", userId: "admin" };
    await upsertRoomMlsGroup(env, auth, "room-1", { maxDevices: 2 });
    await addRoomMlsDevice(env, auth, "room-1", { deviceId: "d1", publicKey: "pk1", signatureKey: "sk1" });
    const second = await addRoomMlsDevice(env, auth, "room-1", { deviceId: "d2", publicKey: "pk2", signatureKey: "sk2" });
    expect(second.group?.devices).toHaveLength(2);
    const third = await addRoomMlsDevice(env, auth, "room-1", { deviceId: "d3", publicKey: "pk3", signatureKey: "sk3" });
    expect(third.ok).toBe(false);
    expect(third.error).toBe("max_devices_exceeded");
  });

  it("rotates epoch", async () => {
    const env = mlsEnv();
    const auth = { projectId: "p1", userId: "admin" };
    await upsertRoomMlsGroup(env, auth, "room-1", {});
    const rotated = await rotateRoomMlsEpoch(env, auth, "room-1");
    expect(rotated.group?.epoch).toBe(1);
    const fetched = await getRoomMlsGroup(env, auth, "room-1");
    expect(fetched.group?.epoch).toBe(1);
  });
});
