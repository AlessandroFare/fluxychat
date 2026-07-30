import { describe, expect, it, vi, afterEach } from "vitest";
import {
  createMemoryOutboxStore,
  createOutboxProcessor,
  createLaneProcessor,
  createChaosHarness,
} from "./outbox-lanes";

describe("offline outbox", () => {
  it("stores and processes entries", async () => {
    const store = createMemoryOutboxStore();
    const sender = vi.fn(async () => true);
    const processor = createOutboxProcessor({ store, sender, retryDelayMs: 50 });
    await store.push({
      id: "msg-1", roomId: "room-1", type: "message",
      payload: { text: "hello" }, createdAt: new Date().toISOString(),
      retryCount: 0, maxRetries: 5,
    });
    expect(await store.pendingCount()).toBe(1);
    processor.start();
    await vi.waitFor(() => expect(sender).toHaveBeenCalled(), { timeout: 2000 });
    processor.stop();
    expect(await store.pendingCount()).toBe(0);
  });

  it("retries on failure up to maxRetries", async () => {
    const store = createMemoryOutboxStore();
    let attempt = 0;
    const sender = vi.fn(async () => { attempt++; return false; });
    const processor = createOutboxProcessor({ store, sender, retryDelayMs: 50, maxRetries: 2 });
    await store.push({
      id: "fail-1", roomId: "room-1", type: "message",
      payload: {}, createdAt: new Date().toISOString(),
      retryCount: 0, maxRetries: 2,
    });
    processor.start();
    await vi.waitFor(() => expect(sender).toHaveBeenCalledTimes(2), { timeout: 5000, interval: 100 });
    processor.stop();
  });
});

describe("transient/durable lanes", () => {
  it("processes messages in priority order", async () => {
    const processor = createLaneProcessor<string>();
    const processed: string[] = [];
    processor.registerHandler("transient", async (msg) => { processed.push(msg.payload); });
    processor.start();
    processor.enqueue({ id: "2", lane: "transient", roomId: "r1", payload: "low", priority: 1, createdAt: new Date().toISOString() });
    processor.enqueue({ id: "1", lane: "transient", roomId: "r1", payload: "high", priority: 10, createdAt: new Date().toISOString() });
    await vi.waitFor(() => expect(processed.length).toBe(2), { timeout: 2000 });
    processor.stop();
    expect(processed[0]).toBe("high");
    expect(processed[1]).toBe("low");
  });

  it("moves durable failures to outbox", async () => {
    const outbox = createMemoryOutboxStore();
    const processor = createLaneProcessor<string>(outbox);
    processor.registerHandler("durable", async () => { throw new Error("fail"); });
    processor.start();
    processor.enqueue({ id: "d1", lane: "durable", roomId: "r1", payload: "test", priority: 0, createdAt: new Date().toISOString() });
    await vi.waitFor(() => expect(outbox.pendingCount()).resolves.toBe(1), { timeout: 2000 });
    processor.stop();
  });

  it("reports queue depth", () => {
    const processor = createLaneProcessor();
    expect(processor.getQueueDepth()).toBe(0);
    processor.enqueue({ id: "1", lane: "transient", roomId: "r1", payload: "a", priority: 0, createdAt: "" });
    processor.enqueue({ id: "2", lane: "durable", roomId: "r1", payload: "b", priority: 0, createdAt: "" });
    expect(processor.getQueueDepth("transient")).toBe(1);
    expect(processor.getQueueDepth("durable")).toBe(1);
    expect(processor.getQueueDepth()).toBe(2);
  });
});

describe("chaos harness", () => {
  it("passes through successful sends", async () => {
    const inner = vi.fn(async () => true);
    const chaos = createChaosHarness(inner);
    const ok = await chaos.send("test");
    expect(ok).toBe(true);
    expect(chaos.getSentCount()).toBe(1);
  });

  it("simulates random failures", async () => {
    const inner = vi.fn(async () => true);
    const chaos = createChaosHarness(inner, { failureRate: 1 });
    const ok = await chaos.send("test");
    expect(ok).toBe(false);
    expect(chaos.getEvents().some((e) => e.type === "send_failure")).toBe(true);
  });

  it("simulates disconnect after N sends", async () => {
    const inner = vi.fn(async () => true);
    const chaos = createChaosHarness(inner, { disconnectAfter: 2, maxReconnectDelay: 50 });
    expect(await chaos.send("a")).toBe(true);
    expect(await chaos.send("b")).toBe(true);
    expect(await chaos.send("c")).toBe(false);
    expect(chaos.isDisconnected()).toBe(true);
    await vi.waitFor(() => expect(chaos.isDisconnected()).toBe(false), { timeout: 500 });
  });

  it("records events", async () => {
    const inner = vi.fn(async () => true);
    const chaos = createChaosHarness(inner, { failureRate: 1, disconnectAfter: 1, maxReconnectDelay: 50 });
    await chaos.send("x");
    await chaos.send("y");
    expect(chaos.getEvents().length).toBeGreaterThanOrEqual(2);
  });
});
