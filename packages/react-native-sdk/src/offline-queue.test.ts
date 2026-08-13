import { describe, it, expect } from "vitest";
import {
  createMemoryRnOutboxStore,
  createAsyncStorageOutboxStore,
  createRnOfflineQueue,
} from "./offline-queue";

describe("NW-114 RN offline queue", () => {
  it("queues while offline and flushes on reconnect", async () => {
    const sent: string[] = [];
    let canSend = false;
    const queue = createRnOfflineQueue({
      store: createMemoryRnOutboxStore(),
      send: async (entry) => {
        if (!canSend) return false;
        sent.push(String(entry.payload.content));
        return true;
      },
    });

    queue.setConnected(false);
    await queue.enqueue({ roomId: "r1", payload: { content: "offline-msg" } });
    expect(await queue.pendingCount()).toBe(1);
    expect(queue.getStatus()).toBe("pending");

    canSend = true;
    queue.setConnected(true);
    await queue.flush();
    expect(sent).toEqual(["offline-msg"]);
    expect(await queue.pendingCount()).toBe(0);
  });

  it("persists via AsyncStorage-like KV", async () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: async (k: string) => map.get(k) ?? null,
      setItem: async (k: string, v: string) => {
        map.set(k, v);
      },
    };
    const store = createAsyncStorageOutboxStore(storage);
    await store.push({
      id: "e1",
      roomId: "r1",
      type: "message",
      payload: { content: "persist" },
      createdAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 5,
    });
    const store2 = createAsyncStorageOutboxStore(storage);
    expect(await store2.pendingCount()).toBe(1);
    const peeked = await store2.peek(1);
    expect(peeked[0]?.payload.content).toBe("persist");
  });
});
