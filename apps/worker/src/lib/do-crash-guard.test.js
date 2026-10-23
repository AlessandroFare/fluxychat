import { describe, expect, it } from "vitest";
import {
  DO_BOOT_STORAGE_KEY,
  DO_SEALED_STORAGE_KEY,
  noteDoBootStart,
  noteDoBootComplete,
  readDoSeal,
  sealAndPurgeDoObject,
  unsealDoObject,
} from "./do-crash-guard.js";

function createStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    async get(key) {
      return store.get(key);
    },
    async put(key, value) {
      store.set(key, value);
    },
    async delete(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) store.delete(key);
    },
    async list() {
      return new Map(store);
    },
  };
}

describe("do-crash-guard", () => {
  it("counts consecutive incomplete boots and resets after a clean boot", async () => {
    const storage = createStorage();
    const first = await noteDoBootStart(storage);
    expect(first).toEqual({ crashed: false, consecutiveCrashes: 0 });

    // Second boot without noteDoBootComplete: the first boot crashed.
    const crashed = await noteDoBootStart(storage);
    expect(crashed).toEqual({ crashed: true, consecutiveCrashes: 1 });

    await noteDoBootComplete(storage);
    const clean = await noteDoBootStart(storage);
    expect(clean).toEqual({ crashed: false, consecutiveCrashes: 0 });
    expect(storage.store.get(DO_BOOT_STORAGE_KEY)).toMatchObject({
      completed: false,
      crashes: 0,
    });
  });

  it("seals and purges everything except the keep list", async () => {
    const storage = createStorage({
      projectId: "proj_1",
      roomId: "room_1",
      "room-pitr:snapshots:v1": [{ id: "pitr_1" }],
      heavy_blob: "x".repeat(32),
      _cost_ledger: { requests: 3 },
      [DO_BOOT_STORAGE_KEY]: { completed: false, crashes: 2 },
    });

    const sealed = await sealAndPurgeDoObject(storage, {
      reason: "boot_crash_loop",
      crashes: 2,
      keepKeys: ["projectId", "roomId", "room-pitr:snapshots:v1"],
    });

    expect(sealed).toMatchObject({ reason: "boot_crash_loop", crashes: 2, purgedKeys: 2 });
    expect(storage.store.get("projectId")).toBe("proj_1");
    expect(storage.store.get("roomId")).toBe("room_1");
    expect(storage.store.get("room-pitr:snapshots:v1")).toEqual([{ id: "pitr_1" }]);
    expect(storage.store.has("heavy_blob")).toBe(false);
    expect(storage.store.has("_cost_ledger")).toBe(false);
    expect(await readDoSeal(storage)).toMatchObject({ reason: "boot_crash_loop" });
    // The boot marker survives so a still-crashing boot cannot loop forever:
    // the next wake reads `_do_sealed` first and never reaches the boot counter.
    expect(storage.store.has(DO_BOOT_STORAGE_KEY)).toBe(true);
  });

  it("unseal clears the seal and the boot marker", async () => {
    const storage = createStorage({
      [DO_SEALED_STORAGE_KEY]: { reason: "boot_crash_loop" },
      [DO_BOOT_STORAGE_KEY]: { completed: false, crashes: 2 },
    });
    await unsealDoObject(storage);
    expect(await readDoSeal(storage)).toBeNull();
    expect(storage.store.has(DO_BOOT_STORAGE_KEY)).toBe(false);
  });
});
