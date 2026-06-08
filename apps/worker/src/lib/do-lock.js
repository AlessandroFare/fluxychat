/**
 * D1-backed distributed lock helper (P11-A2).
 *
 * Use for "claim once across worker instances and shards" patterns where a
 * chat-state-DO style in-process lock would not work (e.g. when a room is
 * sharded across multiple Room DOs, scheduled message dispatch must run on
 * exactly one of them).
 *
 * Properties:
 * - **Atomic acquire** via `INSERT ... ON CONFLICT(key) DO UPDATE ...` so the
 *   row is created or replaced in a single D1 statement.
 * - **Token check on release/extend** to avoid releasing a lock that another
 *   caller has re-acquired after expiry.
 * - **TTL-based expiry** — `sweepExpiredLocks` can be called from any periodic
 *   alarm to keep the table small.
 *
 * Caller responsibility:
 * - Pass a `key` scoped narrowly (e.g. `dispatch:sched:${projectId}:${roomId}:${scheduleId}`).
 * - Always call `releaseLock` (or use `withLock`) once the critical section ends.
 * - Use a short TTL (sub-second to a few seconds) — D1 is strongly consistent
 *   within a region but writes have latency; long-held locks hurt other callers.
 *
 * Inspired by `chat-state-cloudflare-do-main/src/durable-object.ts` (acquireLock
 * with token + expires_at + transactionSync).
 */

/**
 * Idempotent CREATE TABLE — safe to call on every request, no-op if already
 * migrated. Migration `0048_do_locks.sql` creates the table at deploy time,
 * but this helper keeps the lib self-contained for ad-hoc usage.
 *
 * @param {{ DB: { prepare: (sql: string) => { run: () => Promise<unknown> } } }} env
 */
export async function ensureLockTable(env) {
  if (!env?.DB) return;
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS do_locks (key TEXT PRIMARY KEY, token TEXT NOT NULL, expires_at INTEGER NOT NULL)",
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_do_locks_expires ON do_locks (expires_at)",
  ).run();
}

/**
 * @param {{ DB: { prepare: (sql: string) => { bind: (...args: unknown[]) => { first: () => Promise<unknown>, run: () => Promise<unknown> } } } }} env
 * @param {{ key: string }} args
 * @returns {Promise<{ token: string, expiresAt: number } | null>}
 */
export async function readLock(env, { key }) {
  if (!env?.DB) return null;
  const row = await env.DB.prepare(
    "SELECT token, expires_at FROM do_locks WHERE key = ?",
  )
    .bind(key)
    .first();
  if (!row) return null;
  return {
    token: String(row.token),
    expiresAt: Number(row.expires_at),
  };
}

/**
 * Generate a short random token. Uses `crypto.getRandomValues` so it works in
 * the Workers runtime (no Node `crypto.randomBytes`).
 *
 * @returns {string}
 */
export function generateLockToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Try to acquire the lock. Returns `{ token, expiresAt }` on success or
 * `null` if another caller holds an unexpired lock. If the existing lock has
 * expired, it is atomically replaced.
 *
 * @param {object} env
 * @param {{ key: string, ttlMs: number, token?: string }} args
 * @returns {Promise<{ token: string, expiresAt: number } | null>}
 */
export async function acquireLock(env, { key, ttlMs, token }) {
  if (!env?.DB) return null;
  if (!key || typeof key !== "string") {
    throw new Error("acquireLock: key is required");
  }
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error("acquireLock: ttlMs must be a positive number");
  }
  const useToken = token ?? generateLockToken();
  const now = Date.now();
  const expiresAt = now + ttlMs;

  // D1 is strongly consistent within a region; this single statement
  // atomically inserts a new lock OR replaces an expired one. If the existing
  // row is still valid, the WHERE clause excludes it and `run()` returns
  // changes=0, signalling the lock is held.
  const result = await env.DB.prepare(
    `INSERT INTO do_locks (key, token, expires_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       token = excluded.token,
       expires_at = excluded.expires_at
     WHERE do_locks.expires_at <= ?`,
  )
    .bind(key, useToken, expiresAt, now)
    .run();
  const changes = Number(result?.meta?.changes ?? 0);
  if (changes === 0) {
    return null;
  }
  return { token: useToken, expiresAt };
}

/**
 * Release the lock if and only if the token matches.
 *
 * @param {object} env
 * @param {{ key: string, token: string }} args
 * @returns {Promise<boolean>} true if released, false if token mismatch or already gone
 */
export async function releaseLock(env, { key, token }) {
  if (!env?.DB) return false;
  if (!key || !token) return false;
  const result = await env.DB.prepare(
    "DELETE FROM do_locks WHERE key = ? AND token = ?",
  )
    .bind(key, token)
    .run();
  return Number(result?.meta?.changes ?? 0) > 0;
}

/**
 * Extend the lock TTL if and only if the token matches.
 *
 * @param {object} env
 * @param {{ key: string, token: string, ttlMs: number }} args
 * @returns {Promise<boolean>}
 */
export async function extendLock(env, { key, token, ttlMs }) {
  if (!env?.DB) return false;
  if (!key || !token) return false;
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) return false;
  const expiresAt = Date.now() + ttlMs;
  const result = await env.DB.prepare(
    `UPDATE do_locks
     SET expires_at = ?
     WHERE key = ? AND token = ? AND expires_at > ?`,
  )
    .bind(expiresAt, key, token, Date.now())
    .run();
  return Number(result?.meta?.changes ?? 0) > 0;
}

/**
 * Delete expired locks. Returns the number of rows removed. Safe to call
 * concurrently — the WHERE clause guards against removing a live lock.
 *
 * @param {object} env
 * @param {{ now?: number }} [args]
 * @returns {Promise<number>}
 */
export async function sweepExpiredLocks(env, { now } = {}) {
  if (!env?.DB) return 0;
  const cutoff = Number.isFinite(now) ? now : Date.now();
  const result = await env.DB.prepare(
    "DELETE FROM do_locks WHERE expires_at <= ?",
  )
    .bind(cutoff)
    .run();
  return Number(result?.meta?.changes ?? 0);
}

/**
 * Convenience wrapper. Calls `fn()` while holding the lock, releases on
 * resolve/reject, and returns the function's result. If the lock cannot be
 * acquired, returns `null` (caller decides how to back off / retry).
 *
 * @template T
 * @param {object} env
 * @param {{ key: string, ttlMs: number }} lockArgs
 * @param {() => Promise<T>} fn
 * @returns {Promise<T | null>}
 */
export async function withLock(env, lockArgs, fn) {
  const acquired = await acquireLock(env, lockArgs);
  if (!acquired) return null;
  try {
    return await fn();
  } finally {
    await releaseLock(env, { key: lockArgs.key, token: acquired.token });
  }
}
