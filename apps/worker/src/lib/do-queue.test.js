import { describe, expect, it, beforeEach } from "vitest";
import {
  ack,
  clear,
  enqueue,
  peek,
  readQueueSize,
  sweepExpired,
} from "./do-queue.js";

/**
 * Minimal in-memory D1 mock for queue tests. Supports the four SQL shapes
 * the helper issues (INSERT, SELECT, DELETE-IN, DELETE-WHERE, COUNT).
 */
function createMockD1() {
  /** @type {Map<number, { id: number, queue: string, payload: string, created_at: string, expires_at: string }>} */
  const rows = new Map();
  let nextId = 1;
  return {
    rows,
    nextId,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            first: async () => {
              if (/^SELECT COUNT\(\*\) AS n FROM do_queue WHERE queue = \?$/.test(sql)) {
                const [q] = args;
                let n = 0;
                for (const r of rows.values()) if (r.queue === q) n += 1;
                return { n };
              }
              return null;
            },
            all: async () => {
              if (/^SELECT id, queue, payload, created_at, expires_at\s+FROM do_queue\s+WHERE queue = \? AND expires_at > \?\s+ORDER BY id ASC\s+LIMIT \?$/.test(sql)) {
                const [q, cutoff, limit] = args;
                const out = [];
                for (const r of [...rows.values()].sort((a, b) => a.id - b.id)) {
                  if (r.queue !== q) continue;
                  if (r.expires_at <= String(cutoff)) continue;
                  out.push({ id: r.id, queue: r.queue, payload: r.payload, created_at: r.created_at, expires_at: r.expires_at });
                  if (out.length >= Number(limit)) break;
                }
                return { results: out };
              }
              return { results: [] };
            },
            run: async () => {
              return applyQueueSql(sql, args, rows, () => nextId++);
            },
          };
        },
      };
    },
  };
}

function applyQueueSql(sql, args, rows, allocId) {
  if (/^INSERT INTO do_queue \(queue, payload, created_at, expires_at\)\s+VALUES \(/.test(sql)) {
    const [queue, payload, created_at, expires_at] = args;
    const id = allocId();
    rows.set(id, { id, queue: String(queue), payload: String(payload), created_at: String(created_at), expires_at: String(expires_at) });
    return { meta: { changes: 1, last_row_id: id } };
  }
  if (/^DELETE FROM do_queue WHERE queue = \? AND id IN \(/.test(sql)) {
    const [queue, ...ids] = args;
    let n = 0;
    for (const id of ids) {
      const r = rows.get(Number(id));
      if (r && r.queue === queue) {
        rows.delete(Number(id));
        n += 1;
      }
    }
    return { meta: { changes: n } };
  }
  if (/^DELETE FROM do_queue WHERE queue = \?$/.test(sql)) {
    const [queue] = args;
    let n = 0;
    for (const [id, r] of [...rows.entries()]) {
      if (r.queue === queue) {
        rows.delete(id);
        n += 1;
      }
    }
    return { meta: { changes: n } };
  }
  if (/^DELETE FROM do_queue WHERE queue = \? AND expires_at <= \?$/.test(sql)) {
    const [queue, cutoff] = args;
    let n = 0;
    for (const [id, r] of [...rows.entries()]) {
      if (r.queue === queue && r.expires_at <= String(cutoff)) {
        rows.delete(id);
        n += 1;
      }
    }
    return { meta: { changes: n } };
  }
  if (/^DELETE FROM do_queue WHERE expires_at <= \?$/.test(sql)) {
    const [cutoff] = args;
    let n = 0;
    for (const [id, r] of [...rows.entries()]) {
      if (r.expires_at <= String(cutoff)) {
        rows.delete(id);
        n += 1;
      }
    }
    return { meta: { changes: n } };
  }
  return { meta: { changes: 0 } };
}

describe("do-queue", () => {
  /** @type {ReturnType<typeof createMockD1>} */
  let db;
  let env;
  beforeEach(() => {
    db = createMockD1();
    env = { DB: db };
  });

  it("enqueue returns an id and persists the JSON payload", async () => {
    const r = await enqueue(env, { queue: "q1", payload: { type: "x", n: 1 } });
    expect(r.id).toBeGreaterThan(0);
    expect(r.queue).toBe("q1");
    expect(db.rows.size).toBe(1);
  });

  it("peek returns entries in FIFO order, parsing the payload", async () => {
    await enqueue(env, { queue: "q1", payload: { n: 1 } });
    await enqueue(env, { queue: "q1", payload: { n: 2 } });
    await enqueue(env, { queue: "q1", payload: { n: 3 } });
    const batch = await peek(env, { queue: "q1" });
    expect(batch).toHaveLength(3);
    expect(batch.map((b) => b.payload.n)).toEqual([1, 2, 3]);
    expect(batch[0].id).toBeLessThan(batch[1].id);
  });

  it("peek skips expired entries and respects limit", async () => {
    await enqueue(env, { queue: "q1", payload: { n: 1 }, ttlMs: 1000 });
    await enqueue(env, { queue: "q1", payload: { n: 2 }, ttlMs: 1 });
    await new Promise((r) => setTimeout(r, 5));
    const batch = await peek(env, { queue: "q1" });
    expect(batch).toHaveLength(1);
    expect(batch[0].payload.n).toBe(1);
  });

  it("ack removes the requested ids only", async () => {
    const a = await enqueue(env, { queue: "q1", payload: { n: 1 } });
    const b = await enqueue(env, { queue: "q1", payload: { n: 2 } });
    const c = await enqueue(env, { queue: "q1", payload: { n: 3 } });
    const removed = await ack(env, { queue: "q1", ids: [a.id, c.id] });
    expect(removed).toBe(2);
    const remaining = await peek(env, { queue: "q1" });
    expect(remaining.map((r) => r.id)).toEqual([b.id]);
  });

  it("ack is a no-op for unknown ids and for wrong queue", async () => {
    const a = await enqueue(env, { queue: "q1", payload: { n: 1 } });
    const removedWrongQ = await ack(env, { queue: "q2", ids: [a.id] });
    expect(removedWrongQ).toBe(0);
    const removedUnknown = await ack(env, { queue: "q1", ids: [99999] });
    expect(removedUnknown).toBe(0);
    const size = await readQueueSize(env, { queue: "q1" });
    expect(size).toBe(1);
  });

  it("ack rejects empty arrays and batches over 100", async () => {
    expect(await ack(env, { queue: "q1", ids: [] })).toBe(0);
    const big = Array.from({ length: 101 }, (_, i) => i + 1);
    await expect(ack(env, { queue: "q1", ids: big })).rejects.toThrow(/100/);
  });

  it("sweepExpired removes only expired rows for the queue", async () => {
    await enqueue(env, { queue: "q1", payload: { n: 1 }, ttlMs: 60_000 });
    await enqueue(env, { queue: "q1", payload: { n: 2 }, ttlMs: 1 });
    await enqueue(env, { queue: "q2", payload: { n: 3 }, ttlMs: 1 });
    await new Promise((r) => setTimeout(r, 5));
    const removed = await sweepExpired(env, { queue: "q1" });
    expect(removed).toBe(1);
    expect(db.rows.size).toBe(2);
  });

  it("sweepExpired without a queue arg removes across all queues", async () => {
    await enqueue(env, { queue: "q1", payload: { n: 1 }, ttlMs: 1 });
    await enqueue(env, { queue: "q2", payload: { n: 2 }, ttlMs: 1 });
    await enqueue(env, { queue: "q3", payload: { n: 3 }, ttlMs: 60_000 });
    await new Promise((r) => setTimeout(r, 5));
    const removed = await sweepExpired(env);
    expect(removed).toBe(2);
    expect(db.rows.size).toBe(1);
  });

  it("readQueueSize returns the count for a queue", async () => {
    expect(await readQueueSize(env, { queue: "q1" })).toBe(0);
    await enqueue(env, { queue: "q1", payload: {} });
    await enqueue(env, { queue: "q1", payload: {} });
    await enqueue(env, { queue: "q2", payload: {} });
    expect(await readQueueSize(env, { queue: "q1" })).toBe(2);
    expect(await readQueueSize(env, { queue: "q2" })).toBe(1);
  });

  it("clear removes everything for a queue", async () => {
    await enqueue(env, { queue: "q1", payload: {} });
    await enqueue(env, { queue: "q1", payload: {} });
    await enqueue(env, { queue: "q2", payload: {} });
    const n = await clear(env, { queue: "q1" });
    expect(n).toBe(2);
    expect(await readQueueSize(env, { queue: "q1" })).toBe(0);
    expect(await readQueueSize(env, { queue: "q2" })).toBe(1);
  });

  it("enqueue throws DO_QUEUE_FULL when the cap is reached", async () => {
    await enqueue(env, { queue: "q1", payload: {}, maxSize: 2 });
    await enqueue(env, { queue: "q1", payload: {}, maxSize: 2 });
    await expect(
      enqueue(env, { queue: "q1", payload: {}, maxSize: 2 }),
    ).rejects.toMatchObject({ code: "DO_QUEUE_FULL", queue: "q1", size: 2, maxSize: 2 });
  });

  it("enqueue rejects bad inputs", async () => {
    await expect(enqueue(env, { queue: "", payload: {} })).rejects.toThrow(/queue/);
    await expect(enqueue(env, { queue: "q1" })).rejects.toThrow(/payload/);
    await expect(enqueue(env, { queue: "q1", payload: {}, ttlMs: 0 })).rejects.toThrow(/ttlMs/);
    await expect(enqueue(env, { queue: "q1", payload: {}, maxSize: 0 })).rejects.toThrow(/maxSize/);
  });
});
