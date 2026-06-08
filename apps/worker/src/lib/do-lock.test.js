import { describe, expect, it, beforeEach } from "vitest";
import {
  acquireLock,
  extendLock,
  generateLockToken,
  readLock,
  releaseLock,
  sweepExpiredLocks,
  withLock,
} from "./do-lock.js";

/**
 * Minimal in-memory D1 mock for lock tests. Tracks `INSERT … ON CONFLICT DO
 * UPDATE` semantics via a Map and returns `meta.changes` from run().
 */
function createMockD1() {
  /** @type {Map<string, { token: string, expires_at: number }>} */
  const table = new Map();
  return {
    table,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            first: async () => {
              if (/^SELECT token, expires_at FROM do_locks WHERE key = \?$/.test(sql)) {
                const [key] = args;
                return table.get(String(key)) ?? null;
              }
              return null;
            },
            run: async () => {
              const changes = applySql(sql, args, table);
              return { meta: { changes, last_row_id: null } };
            },
          };
        },
      };
    },
  };
}

function applySql(sql, args, table) {
  if (/^INSERT INTO do_locks/.test(sql) && /ON CONFLICT\(key\)/.test(sql)) {
    const [key, token, expiresAt, now] = args;
    const existing = table.get(String(key));
    if (existing && existing.expires_at > Number(now)) {
      return 0; // live lock held
    }
    table.set(String(key), { token: String(token), expires_at: Number(expiresAt) });
    return existing ? 1 : 1;
  }
  if (/^DELETE FROM do_locks WHERE key = \? AND token = \?$/.test(sql)) {
    const [key, token] = args;
    const existing = table.get(String(key));
    if (existing && existing.token === String(token)) {
      table.delete(String(key));
      return 1;
    }
    return 0;
  }
  if (/^UPDATE do_locks\s+SET expires_at/.test(sql)) {
    const [expiresAt, key, token, now] = args;
    const existing = table.get(String(key));
    if (existing && existing.token === String(token) && existing.expires_at > Number(now)) {
      existing.expires_at = Number(expiresAt);
      return 1;
    }
    return 0;
  }
  if (/^DELETE FROM do_locks WHERE expires_at <= \?$/.test(sql)) {
    const [cutoff] = args;
    let n = 0;
    for (const [k, v] of [...table.entries()]) {
      if (v.expires_at <= Number(cutoff)) {
        table.delete(k);
        n += 1;
      }
    }
    return n;
  }
  return 0;
}

describe("do-lock", () => {
  /** @type {ReturnType<typeof createMockD1>} */
  let db;
  let env;
  beforeEach(() => {
    db = createMockD1();
    env = { DB: db };
  });

  it("acquires an unheld lock and returns a token + expiry", async () => {
    const lock = await acquireLock(env, { key: "k1", ttlMs: 1000 });
    expect(lock).not.toBeNull();
    expect(typeof lock?.token).toBe("string");
    expect(lock?.token.length).toBeGreaterThan(0);
    expect(lock?.expiresAt).toBeGreaterThan(Date.now());
    expect(db.table.size).toBe(1);
  });

  it("refuses to acquire a lock already held by another caller", async () => {
    const first = await acquireLock(env, { key: "k1", ttlMs: 5000 });
    const second = await acquireLock(env, { key: "k1", ttlMs: 5000 });
    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(db.table.size).toBe(1);
  });

  it("replaces an expired lock on a fresh acquire (no token retention)", async () => {
    const first = await acquireLock(env, { key: "k1", ttlMs: 1 });
    expect(first).not.toBeNull();
    // Wait for the lock to expire
    await new Promise((r) => setTimeout(r, 10));
    const second = await acquireLock(env, { key: "k1", ttlMs: 5000 });
    expect(second).not.toBeNull();
    expect(second?.token).not.toBe(first?.token);
  });

  it("release with the correct token removes the row", async () => {
    const lock = await acquireLock(env, { key: "k1", ttlMs: 5000 });
    const released = await releaseLock(env, { key: "k1", token: lock.token });
    expect(released).toBe(true);
    expect(db.table.size).toBe(0);
  });

  it("release with the wrong token is a no-op", async () => {
    const lock = await acquireLock(env, { key: "k1", ttlMs: 5000 });
    const released = await releaseLock(env, { key: "k1", token: "wrong" });
    expect(released).toBe(false);
    expect(db.table.size).toBe(1);
    // The original holder can still release
    const real = await releaseLock(env, { key: "k1", token: lock.token });
    expect(real).toBe(true);
  });

  it("extend bumps the expiry when the token matches", async () => {
    const lock = await acquireLock(env, { key: "k1", ttlMs: 100 });
    const before = await readLock(env, { key: "k1" });
    const extended = await extendLock(env, {
      key: "k1",
      token: lock.token,
      ttlMs: 10_000,
    });
    expect(extended).toBe(true);
    const after = await readLock(env, { key: "k1" });
    expect(after.expiresAt).toBeGreaterThan(before.expiresAt + 5000);
  });

  it("extend with the wrong token returns false and does not change the row", async () => {
    const lock = await acquireLock(env, { key: "k1", ttlMs: 5000 });
    const before = await readLock(env, { key: "k1" });
    const extended = await extendLock(env, {
      key: "k1",
      token: "wrong",
      ttlMs: 60_000,
    });
    expect(extended).toBe(false);
    const after = await readLock(env, { key: "k1" });
    expect(after.expiresAt).toBe(before.expiresAt);
  });

  it("sweep removes only expired rows", async () => {
    await acquireLock(env, { key: "live", ttlMs: 60_000 });
    const expired = await acquireLock(env, { key: "expired", ttlMs: 1 });
    expect(expired).not.toBeNull();
    await new Promise((r) => setTimeout(r, 5));
    const removed = await sweepExpiredLocks(env);
    expect(removed).toBe(1);
    expect(db.table.size).toBe(1);
    expect(db.table.has("live")).toBe(true);
  });

  it("withLock runs the function and releases the lock", async () => {
    const seen = [];
    const result = await withLock(env, { key: "k1", ttlMs: 5000 }, async () => {
      seen.push("inside");
      expect(db.table.size).toBe(1);
      return 42;
    });
    expect(result).toBe(42);
    expect(seen).toEqual(["inside"]);
    expect(db.table.size).toBe(0);
  });

  it("withLock returns null if the lock is already held and still releases nothing", async () => {
    const first = await acquireLock(env, { key: "k1", ttlMs: 5000 });
    const result = await withLock(env, { key: "k1", ttlMs: 5000 }, async () => "nope");
    expect(result).toBeNull();
    // First lock is still held
    const stillThere = await readLock(env, { key: "k1" });
    expect(stillThere.token).toBe(first.token);
  });

  it("withLock releases even when the function throws", async () => {
    await expect(
      withLock(env, { key: "k1", ttlMs: 5000 }, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(db.table.size).toBe(0);
  });

  it("generateLockToken returns 32 hex chars (16 random bytes)", () => {
    const t = generateLockToken();
    expect(t).toMatch(/^[0-9a-f]{32}$/);
  });

  it("acquireLock rejects missing key or invalid ttl", async () => {
    await expect(acquireLock(env, { key: "", ttlMs: 100 })).rejects.toThrow(/key/);
    await expect(acquireLock(env, { key: "k", ttlMs: 0 })).rejects.toThrow(/ttlMs/);
    await expect(acquireLock(env, { key: "k", ttlMs: -1 })).rejects.toThrow(/ttlMs/);
  });
});
