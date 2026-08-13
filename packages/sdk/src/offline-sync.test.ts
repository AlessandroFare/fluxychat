import { describe, it, expect } from "vitest";
import { createMemoryOutboxStore } from "./outbox-lanes.js";
import { createOfflineSyncController } from "./offline-sync.js";
import { createMemoryEventLog } from "./offline-event-log.js";

describe("offline-sync (NW-100)", () => {
  it("queues messages when disconnected and flushes on reconnect", async () => {
    const sent: string[] = [];
    let canSend = false;
    const sync = await createOfflineSyncController({
      store: createMemoryOutboxStore(),
      send: async (entry) => {
        if (!canSend) return false;
        sent.push(String(entry.payload.content));
        return true;
      },
    });

    sync.setConnected(false);
    await sync.outbox.enqueue({
      roomId: "room-1",
      payload: { content: "hello offline" },
    });
    expect(sync.pendingCount).toBe(1);
    expect(sync.status).toBe("pending");

    canSend = true;
    sync.setConnected(true);
    await new Promise((r) => setTimeout(r, 10));
    await sync.flush();
    expect(sent).toEqual(["hello offline"]);
    expect(sync.pendingCount).toBe(0);
    expect(["synced", "syncing"]).toContain(sync.status);
  });

  it("records WS events in event log", async () => {
    const log = createMemoryEventLog();
    await log.append("room-1", { type: "message", id: 1, roomId: "room-1", userId: "u1", content: "hi", createdAt: "2026-01-01T00:00:00Z" });
    const since = await log.getSince("room-1", "2026-01-01T00:00:00Z");
    expect(since).toHaveLength(1);
    expect(since[0].event.type).toBe("message");
  });
});
