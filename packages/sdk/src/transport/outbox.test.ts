import { describe, expect, it, vi } from "vitest";
import { createMemoryOutboxStore } from "../outbox-lanes.js";
import { createMessageOutbox } from "./outbox.js";

describe("createMessageOutbox", () => {
  it("queues messages and sends via processor", async () => {
    const sender = vi.fn(async () => true);
    const outbox = createMessageOutbox({ store: createMemoryOutboxStore(), send: sender, retryDelayMs: 30 });

    await outbox.enqueue({ roomId: "room-1", payload: { text: "offline" } });
    await vi.waitFor(() => expect(sender).toHaveBeenCalled(), { timeout: 2000 });
    expect(await outbox.pendingCount()).toBe(0);
    outbox.stop();
  });

  it("flushes on reconnect open event", async () => {
    const sender = vi.fn(async () => true);
    const outbox = createMessageOutbox({
      store: createMemoryOutboxStore(),
      send: sender,
      retryDelayMs: 30,
      autoStart: false,
    });
    const listeners = new Map<string, Set<() => void>>();
    const connection = {
      on(event: "open", handler: () => void) {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event)!.add(handler);
      },
      off(event: "open", handler: () => void) {
        listeners.get(event)?.delete(handler);
      },
    };

    const unbind = outbox.bindReconnect(connection);
    await outbox.enqueue({ roomId: "room-2", payload: { text: "queued" } });
    expect(sender).not.toHaveBeenCalled();

    for (const handler of listeners.get("open") ?? []) handler();
    await vi.waitFor(() => expect(sender).toHaveBeenCalled(), { timeout: 2000 });
    unbind();
    outbox.stop();
  });
});
