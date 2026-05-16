import { describe, expect, it, vi } from "vitest";
import { RoomDurableObject } from "./room-do.js";

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
});
