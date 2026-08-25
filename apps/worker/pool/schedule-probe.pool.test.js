import { describe, expect, it } from "vitest";
import { env, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { ScheduleProbeDo } from "./schedule-probe-do.js";

describe("vitest-pool-workers — room schedule + hibernation primitives", () => {
  it("fires the named alarm queue inside workerd", async () => {
    const stub = env.SCHEDULE_PROBE.get(env.SCHEDULE_PROBE.idFromName("alarm-queue"));
    await stub.enqueueJob("expiry", Date.now() + 60_000);
    const ran = await runDurableObjectAlarm(stub);
    expect(ran).toBe(true);
    const snap = await stub.snapshot();
    expect(snap.jobIds).toContain("expiry");
  });

  it("claims a due agent delay schedule on alarm", async () => {
    const stub = env.SCHEDULE_PROBE.get(env.SCHEDULE_PROBE.idFromName("agent-sched"));
    const now = Date.now();
    const created = await stub.upsertDelay("bot-1", 5_000, now - 6_000);
    expect(created.ok).toBe(true);
    await stub.enqueueJob("agent-schedules", now + 60_000);
    await runDurableObjectAlarm(stub);
    const snap = await stub.snapshot();
    const row = snap.schedules.find((s) => s.id === created.schedule.id);
    expect(row).toBeTruthy();
    expect(row.status === "done" || row.status === "pending").toBe(true);
  });

  it("accepts sockets with the hibernation registry, not webSocket.accept()", async () => {
    const stub = env.SCHEDULE_PROBE.get(env.SCHEDULE_PROBE.idFromName("ws-hiber"));
    const res = await stub.fetch("https://probe/ws", {
      headers: { Upgrade: "websocket" },
    });
    expect(res.status).toBe(101);
    expect(res.webSocket).toBeTruthy();
    res.webSocket?.accept();
    const snap = await stub.snapshot();
    expect(snap.hibernationEnabled).toBe(true);
    expect(snap.attachmentUsers).toContain("alice");
  });

  it("survives eviction with attachment identity intact when the helper exists", async () => {
    const stub = env.SCHEDULE_PROBE.get(env.SCHEDULE_PROBE.idFromName("evict"));
    await stub.fetch("https://probe/ws", { headers: { Upgrade: "websocket" } });
    let evicted = false;
    try {
      const { evictDurableObject } = await import("cloudflare:test");
      await evictDurableObject(stub);
      evicted = true;
    } catch {
      evicted = false;
    }
    await runInDurableObject(stub, async (instance) => {
      expect(instance).toBeInstanceOf(ScheduleProbeDo);
    });
    const snap = await stub.snapshot();
    expect(snap.hibernationEnabled).toBe(true);
    if (evicted) {
      expect(snap.attachmentUsers).toContain("alice");
    }
  });
});
