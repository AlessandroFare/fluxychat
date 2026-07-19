import { describe, it, expect } from "vitest";
import { createConcurrencyStrategy, type ConcurrencyStrategyInstance } from "./concurrency";

async function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe("concurrent strategy", () => {
  it("executes handlers immediately", async () => {
    const s = createConcurrencyStrategy({ strategy: "concurrent" });
    const result = await s.enqueue("msg", async () => "done");
    expect(result).toBe("done");
  });

  it("is never busy", () => {
    const s = createConcurrencyStrategy({ strategy: "concurrent" });
    expect(s.isBusy()).toBe(false);
  });
});

describe("drop strategy", () => {
  it("executes when not busy", async () => {
    const s = createConcurrencyStrategy({ strategy: "drop" });
    const result = await s.enqueue("msg", async () => "ok");
    expect(result).toBe("ok");
  });

  it("drops when busy", async () => {
    const s = createConcurrencyStrategy({ strategy: "drop" });
    const slow = s.enqueue("msg1", () => delay(100).then(() => "slow"));
    const dropped = await s.enqueue("msg2", async () => "should not run");
    expect(dropped).toBeNull();
    await slow;
  });

  it("reports busy state", async () => {
    const s = createConcurrencyStrategy({ strategy: "drop" });
    expect(s.isBusy()).toBe(false);
    const p = s.enqueue("msg", () => delay(50).then(() => "ok"));
    expect(s.isBusy()).toBe(true);
    await p;
    expect(s.isBusy()).toBe(false);
  });
});

describe("queue strategy", () => {
  it("executes handlers sequentially", async () => {
    const s = createConcurrencyStrategy({ strategy: "queue", maxQueueSize: 10 });
    const order: number[] = [];
    const p1 = s.enqueue("msg1", async () => { await delay(20); order.push(1); return "a"; });
    const p2 = s.enqueue("msg2", async () => { order.push(2); return "b"; });
    await p1;
    await p2;
    expect(order).toEqual([1, 2]);
  });

  it("rejects when queue is full with drop-newest", async () => {
    const s = createConcurrencyStrategy({ strategy: "queue", maxQueueSize: 1, onQueueFull: "drop-newest" });
    const p1 = s.enqueue("msg1", () => delay(100).then(() => "ok"));
    const p2 = s.enqueue("msg2", async () => "queued");
    await expect(s.enqueue("msg3", async () => "rejected")).rejects.toThrow("Queue full");
    await p1;
    expect(await p2).toBe("queued");
  });

  it("drops oldest when queue full with drop-oldest", async () => {
    const s = createConcurrencyStrategy({ strategy: "queue", maxQueueSize: 1, onQueueFull: "drop-oldest" });
    const p1 = s.enqueue("msg1", () => delay(100).then(() => "ok"));
    const p2 = s.enqueue("msg2", async () => "queued");
    const p3 = s.enqueue("msg3", async () => "new");
    await expect(p2).rejects.toThrow("dropped oldest");
    expect(await p3).toBe("new");
    await p1;
  });

  it("reports pending count", async () => {
    const s = createConcurrencyStrategy({ strategy: "queue", maxQueueSize: 10 });
    const p1 = s.enqueue("msg1", () => delay(100).then(() => "ok"));
    const p2 = s.enqueue("msg2", () => delay(5).then(() => "ok"));
    expect(s.pending()).toBeGreaterThanOrEqual(1);
    await p1;
    await p2;
    expect(s.pending()).toBe(0);
  });
});

describe("debounce strategy", () => {
  it("delays execution", async () => {
    const s = createConcurrencyStrategy({ strategy: "debounce", debounceMs: 50 });
    const start = Date.now();
    await s.enqueue("msg", async () => "debounced");
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });

  it("resets timer on new enqueue", async () => {
    const s = createConcurrencyStrategy({ strategy: "debounce", debounceMs: 100 });
    const order: string[] = [];
    s.enqueue("msg1", async () => { order.push("first"); return "a"; });
    await delay(30);
    await s.enqueue("msg2", async () => { order.push("second"); return "b"; });
    await delay(150);
    expect(order).toEqual(["second"]);
  });
});

describe("burst strategy", () => {
  it("allows concurrent execution up to maxConcurrent", async () => {
    const s = createConcurrencyStrategy({ strategy: "burst", maxConcurrent: 2, maxQueueSize: 10 });
    let concurrent = 0;
    let maxSeen = 0;
    const run = async () => {
      concurrent++;
      maxSeen = Math.max(maxSeen, concurrent);
      await delay(50);
      concurrent--;
    };
    await Promise.all([
      s.enqueue("msg1", run),
      s.enqueue("msg2", run),
      s.enqueue("msg3", run),
    ]);
    expect(maxSeen).toBeLessThanOrEqual(2);
  });
});

describe("drain", () => {
  it("cancels pending operations", async () => {
    const s = createConcurrencyStrategy({ strategy: "queue", maxQueueSize: 5 });
    const p1 = s.enqueue("msg1", () => delay(100).then(() => "ok"));
    s.enqueue("msg2", async () => "dropped");
    await s.drain();
    await expect(p1).resolves.toBe("ok");
  });

  it("works on idle strategies", async () => {
    const s = createConcurrencyStrategy({ strategy: "concurrent" });
    await expect(s.drain()).resolves.toBeUndefined();
  });
});
