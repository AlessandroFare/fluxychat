import { describe, expect, it, vi } from "vitest";
import { RoomDurableObject } from "./room-do.js";
import { DO_BOOT_STORAGE_KEY, DO_SEALED_STORAGE_KEY } from "../lib/do-crash-guard.js";

function createDoState(roomId = "room_store") {
  const store = new Map();
  return {
    id: { toString: () => roomId },
    storage: {
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
    },
    blockConcurrencyWhile(fn) {
      return fn();
    },
    _store: store,
  };
}

describe("RoomDurableObject storage (hibernation recovery)", () => {
  it("restores projectId from storage after simulated wake", async () => {
    const state = createDoState();
    state._store.set("projectId", "proj_persisted");
    state._store.set("roomId", "room_persisted");

    const roomDo = new RoomDurableObject(state, { DB: {} });
    await roomDo.ensureStorageHydrated();
    expect(roomDo.projectId).toBe("proj_persisted");
    expect(roomDo.roomId).toBe("room_persisted");
  });

  it("persistRoomContext writes project and room ids", async () => {
    const state = createDoState();
    const roomDo = new RoomDurableObject(state, { DB: {} });
    await roomDo.persistRoomContext("proj_new", "room_new");
    expect(state._store.get("projectId")).toBe("proj_new");
    expect(state._store.get("roomId")).toBe("room_new");
  });

  it("marks a clean boot as completed", async () => {
    const state = createDoState();
    const roomDo = new RoomDurableObject(state, { DB: {} });
    await roomDo.ensureStorageHydrated();
    expect(roomDo.sealed).toBeNull();
    expect(state._store.get(DO_BOOT_STORAGE_KEY)).toMatchObject({
      completed: true,
      crashes: 0,
    });
  });

  it("seals and purges after consecutive incomplete boots", async () => {
    const state = createDoState();
    state._store.set("projectId", "proj_persisted");
    state._store.set("roomId", "room_persisted");
    state._store.set("heavy_blob", "x".repeat(64));
    state._store.set("room-pitr:snapshots:v1", [{ id: "pitr_1" }]);
    state._store.set(DO_BOOT_STORAGE_KEY, { startedAt: 1, completed: false, crashes: 1 });

    const roomDo = new RoomDurableObject(state, { DB: {} });
    await roomDo.ensureStorageHydrated();

    expect(roomDo.sealed).toMatchObject({ reason: "boot_crash_loop", crashes: 2 });
    expect(state._store.has("heavy_blob")).toBe(false);
    expect(state._store.get("projectId")).toBe("proj_persisted");
    expect(state._store.get("roomId")).toBe("room_persisted");
    expect(state._store.get("room-pitr:snapshots:v1")).toEqual([{ id: "pitr_1" }]);
    expect(state._store.get(DO_SEALED_STORAGE_KEY)).toMatchObject({
      reason: "boot_crash_loop",
    });
  });

  it("keeps a sealed room sealed on later wakes without re-purging", async () => {
    const state = createDoState();
    state._store.set(DO_SEALED_STORAGE_KEY, {
      sealedAt: "2026-10-16T00:00:00.000Z",
      reason: "boot_crash_loop",
      crashes: 2,
    });
    state._store.set("projectId", "proj_persisted");

    const roomDo = new RoomDurableObject(state, { DB: {} });
    await roomDo.ensureStorageHydrated();

    expect(roomDo.sealed).toMatchObject({ reason: "boot_crash_loop" });
    expect(state._store.get("projectId")).toBe("proj_persisted");
    expect(state._store.get(DO_BOOT_STORAGE_KEY)).toBeUndefined();
  });

  it("reports the seal over /sealed and unseals on POST", async () => {
    const state = createDoState();
    state._store.set(DO_SEALED_STORAGE_KEY, {
      sealedAt: "2026-10-16T00:00:00.000Z",
      reason: "boot_crash_loop",
      crashes: 2,
    });
    const roomDo = new RoomDurableObject(state, { DB: {} });
    await roomDo.ensureStorageHydrated();

    const statusRes = await roomDo.fetch(new Request("https://internal/sealed"));
    expect(statusRes.status).toBe(200);
    const status = await statusRes.json();
    expect(status.sealed).toMatchObject({ reason: "boot_crash_loop" });

    const unsealRes = await roomDo.fetch(
      new Request("https://internal/sealed", { method: "POST" }),
    );
    expect(unsealRes.status).toBe(200);
    expect(await unsealRes.json()).toEqual({ ok: true, sealed: null });
    expect(roomDo.sealed).toBeNull();
    expect(state._store.has(DO_SEALED_STORAGE_KEY)).toBe(false);
    expect(state._store.has(DO_BOOT_STORAGE_KEY)).toBe(false);
  });

  it("refuses streams, announcements, sockets, and alarms while sealed", async () => {
    const state = createDoState();
    state._store.set(DO_SEALED_STORAGE_KEY, {
      sealedAt: "2026-10-16T00:00:00.000Z",
      reason: "boot_crash_loop",
      crashes: 2,
    });
    const roomDo = new RoomDurableObject(state, { DB: {} });
    await roomDo.ensureStorageHydrated();

    const streamRes = await roomDo.fetch(
      new Request("https://internal/stream", { method: "POST" }),
    );
    expect(streamRes.status).toBe(503);
    expect(await streamRes.json()).toEqual({ ok: false, error: "room_sealed" });

    const announceRes = await roomDo.fetch(
      new Request("https://internal/announce", { method: "POST" }),
    );
    expect(announceRes.status).toBe(200);
    expect(await announceRes.json()).toEqual({ ok: true, skipped: "room_sealed" });

    await expect(roomDo.alarm()).resolves.toBeUndefined();

    const nativeResponse = globalThis.Response;
    const nativePair = globalThis.WebSocketPair;
    let server = null;
    class FakeResponse {
      constructor(_body, init = {}) {
        this.status = init.status ?? 200;
        this.webSocket = init.webSocket ?? null;
      }
    }
    class FakeWebSocketPair {
      constructor() {
        server = {
          accept() {},
          close(code, reason) {
            server.closed = [code, reason];
          },
        };
        this[0] = {};
        this[1] = server;
      }
    }
    globalThis.Response = FakeResponse;
    globalThis.WebSocketPair = FakeWebSocketPair;
    try {
      const wsRes = await roomDo.fetch(
        new Request("https://internal/ws", { headers: { Upgrade: "websocket" } }),
      );
      expect(wsRes.status).toBe(101);
      expect(server.closed).toEqual([1011, "room_sealed"]);
    } finally {
      globalThis.Response = nativeResponse;
      globalThis.WebSocketPair = nativePair;
    }
  });
});
