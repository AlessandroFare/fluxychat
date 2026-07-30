import { describe, expect, it, vi, afterEach } from "vitest";
import {
  createDeltaPoller,
  createMemoryDeltaStore,
  createPresenceLeaseManager,
  createMemoryDurableStreamStore,
} from "./delta-sync";

describe("delta sync", () => {
  const store = createMemoryDeltaStore();

  afterEach(async () => {
    /* no cleanup needed between tests for memory store */
  });

  it("appends and queries changes", async () => {
    await store.append("room-1", {
      eventId: "evt-1",
      sequence: 1,
      roomId: "room-1",
      occurredAt: new Date().toISOString(),
      type: "create",
      payload: { text: "hello" },
      stage: "accepted",
    });
    const result = await store.query("room-1", { version: "fluxy.reliability.v1", roomId: "room-1", sequence: 0 });
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].eventId).toBe("evt-1");
    expect(result.hasMore).toBe(false);
  });

  it("delta poller calls onChanges", async () => {
    const onChanges = vi.fn();
    const store2 = createMemoryDeltaStore();
    const poller = createDeltaPoller({ store: store2, onChanges, batchIntervalMs: 50 });
    await store2.append("room-1", {
      eventId: "evt-poll",
      sequence: 1,
      roomId: "room-1",
      occurredAt: new Date().toISOString(),
      type: "create",
      payload: { text: "polled" },
      stage: "delivered",
    });
    const cursor = { version: "fluxy.reliability.v1" as const, roomId: "room-1", sequence: 0 };
    poller.setCursor(cursor);
    poller.start();
    await vi.waitFor(() => expect(onChanges).toHaveBeenCalled(), { timeout: 2000 });
    poller.stop();
    expect(onChanges).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ eventId: "evt-poll" })]),
      expect.objectContaining({ sequence: 1 }),
    );
  });

  it("memory store prunes old entries", async () => {
    const s = createMemoryDeltaStore();
    await s.append("room-p", {
      eventId: "old", sequence: 1, roomId: "room-p",
      occurredAt: new Date(Date.now() - 10_000).toISOString(),
      type: "create", payload: {}, stage: "accepted",
    });
    const pruned = await s.prune("room-p", 1_000);
    expect(pruned).toBe(1);
    const result = await s.query("room-p", { version: "fluxy.reliability.v1", roomId: "room-p", sequence: 0 });
    expect(result.changes).toHaveLength(0);
  });
});

describe("presence leases", () => {
  it("renews a lease", () => {
    const manager = createPresenceLeaseManager({ ttlMs: 60_000, renewBeforeMs: 10_000 });
    const lease = manager.renew("room-1", "user-1", { metadata: { status: "online" } });
    expect(lease.userId).toBe("user-1");
    expect(lease.online).toBe(true);
    expect(lease.metadata).toEqual({ status: "online" });
    const got = manager.get("room-1", "user-1");
    expect(got).not.toBeNull();
    expect(got!.roomId).toBe("room-1");
  });

  it("shouldRenew returns true close to expiry", () => {
    const manager = createPresenceLeaseManager({ ttlMs: 60_000, renewBeforeMs: 59_000 });
    const lease = manager.renew("room-2", "user-2");
    const fresh = manager.shouldRenew(manager.renew("room-2", "user-2"));
    expect(fresh).toBe(false);
    const oldLease: ReturnType<typeof manager.renew> = {
      ...lease,
      leaseExpiresAt: new Date(Date.now() + 1_000).toISOString(),
    };
    expect(manager.shouldRenew(oldLease)).toBe(true);
  });

  it("expire removes a lease", () => {
    const manager = createPresenceLeaseManager({ ttlMs: 60_000, renewBeforeMs: 10_000 });
    manager.renew("room-3", "user-3");
    manager.expire("room-3", "user-3");
    expect(manager.get("room-3", "user-3")).toBeNull();
  });

  it("list returns online leases for a room", () => {
    const manager = createPresenceLeaseManager({ ttlMs: 60_000, renewBeforeMs: 10_000 });
    manager.renew("room-a", "alice");
    manager.renew("room-a", "bob");
    manager.renew("room-b", "charlie");
    expect(manager.list("room-a")).toHaveLength(2);
    expect(manager.list("room-b")).toHaveLength(1);
  });

  it("start/stop expiry timer", () => {
    const manager = createPresenceLeaseManager({ ttlMs: 100, renewBeforeMs: 50 });
    manager.renew("room-x", "user-x");
    manager.start();
    manager.stop();
    expect(manager.list("room-x")).toHaveLength(1);
  });
});

describe("durable agent streams", () => {
  it("saves and retrieves streams", async () => {
    const store = createMemoryDurableStreamStore();
    await store.save({
      streamId: "stream-1",
      roomId: "room-1",
      agentId: "agent-1",
      runId: "run-1",
      status: "active",
      content: "Hello",
    });
    const got = await store.get("stream-1");
    expect(got).not.toBeNull();
    expect(got!.content).toBe("Hello");
    expect(got!.status).toBe("active");
  });

  it("appends content to existing stream", async () => {
    const store = createMemoryDurableStreamStore();
    await store.save({
      streamId: "stream-2",
      roomId: "room-1",
      agentId: "agent-2",
      runId: "run-2",
      status: "active",
      content: "Start",
    });
    await store.appendContent("stream-2", " + more");
    const got = await store.get("stream-2");
    expect(got!.content).toBe("Start + more");
  });

  it("updates status", async () => {
    const store = createMemoryDurableStreamStore();
    await store.save({
      streamId: "stream-3", roomId: "room-1", agentId: "agent-3",
      runId: "run-3", status: "active", content: "",
    });
    await store.updateStatus("stream-3", "completed");
    const got = await store.get("stream-3");
    expect(got!.status).toBe("completed");
  });

  it("getActiveForRoom filters correctly", async () => {
    const store = createMemoryDurableStreamStore();
    await store.save({ streamId: "s1", roomId: "r1", agentId: "a1", runId: "r1", status: "active", content: "" });
    await store.save({ streamId: "s2", roomId: "r1", agentId: "a2", runId: "r2", status: "paused", content: "" });
    await store.save({ streamId: "s3", roomId: "r1", agentId: "a3", runId: "r3", status: "completed", content: "" });
    const active = await store.getActiveForRoom("r1");
    expect(active).toHaveLength(2);
  });
});
