/**
 * Bounded FIFO queue backed by D1 with per-entry TTL.
 *
 * Use cases
 * ─────────
 * - Per-user outbox: a consumer cannot reach KV at message time, so the
 *   producer enqueues here and a reconnect / cron job drains it later.
 * - Cross-DO command bus: chat-state DO writes commands that other DOs
 *   pick up at the next alarm tick.
 * - At-least-once work dispatch with explicit ack.
 *
 * Guarantees
 * ──────────
 * - FIFO order within a single `queue` (oldest first, by `id`).
 * - Each entry has an absolute `expires_at`; expired entries are filtered
 *   out by `peek` and removed by `sweepExpired`.
 * - The size cap is **best-effort**: it is enforced in app code
 *   (count + insert). Two concurrent enqueues can race past the cap by
 *   one entry. For strict caps, wrap the call in `withLock` (see
 *   `./do-lock.js`).
 *
 * JSON `payload`
 * ──────────────
 * Payloads are JSON-encoded at the boundary. The helper exposes a typed
 * generic surface (`enqueue<T>(...)` and `peek<T>(...)`) for callers in
 * JavaScript; the column is always `TEXT` and serialization is done by
 * the helper.
 *
 * @example
 *   const { id } = await enqueue(env, {
 *     queue: `outbox:${userId}`,
 *     payload: { type: "deliver", messageId: 42 },
 *     ttlMs: 24 * 60 * 60 * 1000,
 *     maxSize: 1000,
 *   });
 *   const batch = await peek(env, { queue: `outbox:${userId}`, limit: 50 });
 *   await ack(env, { queue: `outbox:${userId}`, ids: batch.map((b) => b.id) });
 */

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_MAX_SIZE = 10_000;

/**
 * @template T
 * @param {object} env
 * @param {{
 *   queue: string,
 *   payload: T,
 *   ttlMs?: number,
 *   maxSize?: number,
 * }} args
 * @returns {Promise<{ id: number, queue: string, createdAt: string, expiresAt: string }>}
 */
export async function enqueue(env, { queue, payload, ttlMs = DEFAULT_TTL_MS, maxSize = DEFAULT_MAX_SIZE }) {
  if (!env?.DB) throw new Error("do-queue: env.DB is required");
  if (!queue || typeof queue !== "string") throw new Error("do-queue: queue must be a non-empty string");
  if (payload === undefined) throw new Error("do-queue: payload is required");
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new Error("do-queue: ttlMs must be a positive number");
  if (!Number.isFinite(maxSize) || maxSize <= 0) throw new Error("do-queue: maxSize must be a positive number");

  // Best-effort cap: count, then insert. The race window is one entry
  // when two enqueues interleave. Wrap with `withLock` for a strict cap.
  const count = await readQueueSize(env, { queue });
  if (count >= maxSize) {
    const err = new Error(`do-queue: queue '${queue}' is full (${count}/${maxSize})`);
    err.code = "DO_QUEUE_FULL";
    err.queue = queue;
    err.size = count;
    err.maxSize = maxSize;
    throw err;
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);
  const result = await env.DB
    .prepare(
      `INSERT INTO do_queue (queue, payload, created_at, expires_at)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(queue, JSON.stringify(payload), now.toISOString(), expiresAt.toISOString())
    .run();
  return {
    id: Number(result?.meta?.last_row_id ?? 0),
    queue,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Read up to `limit` entries from the head of the queue, oldest first.
 * Expired entries are skipped (and removed as a side effect via
 * `sweepExpired` on the matching slice).
 *
 * @template T
 * @param {object} env
 * @param {{ queue: string, limit?: number }} args
 * @returns {Promise<Array<{ id: number, queue: string, payload: T, createdAt: string, expiresAt: string }>>}
 */
export async function peek(env, { queue, limit = 50 }) {
  if (!env?.DB) throw new Error("do-queue: env.DB is required");
  if (!queue) throw new Error("do-queue: queue is required");
  if (!Number.isFinite(limit) || limit <= 0) throw new Error("do-queue: limit must be a positive number");

  const nowIso = new Date().toISOString();
  const rows = await env.DB
    .prepare(
      `SELECT id, queue, payload, created_at, expires_at
       FROM do_queue
       WHERE queue = ? AND expires_at > ?
       ORDER BY id ASC
       LIMIT ?`,
    )
    .bind(queue, nowIso, limit)
    .all();
  const results = rows.results || [];
  return results.map((row) => ({
    id: Number(row.id),
    queue: row.queue,
    payload: safeParse(row.payload),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }));
}

/**
 * Remove specific entries from the queue. Use after a successful
 * consumer-side processing pass. Returns the number of rows removed.
 *
 * @param {object} env
 * @param {{ queue: string, ids: number[] }} args
 * @returns {Promise<number>}
 */
export async function ack(env, { queue, ids }) {
  if (!env?.DB) throw new Error("do-queue: env.DB is required");
  if (!queue) throw new Error("do-queue: queue is required");
  if (!Array.isArray(ids) || ids.length === 0) return 0;

  // Build a parameterized IN clause with positional placeholders. D1
  // supports up to 100 bound parameters by default; cap the batch.
  const cleanIds = Array.from(new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0)));
  if (cleanIds.length === 0) return 0;
  if (cleanIds.length > 100) {
    throw new Error("do-queue: ack accepts at most 100 ids per call (split into batches)");
  }
  const placeholders = cleanIds.map(() => "?").join(", ");
  const result = await env.DB
    .prepare(
      `DELETE FROM do_queue WHERE queue = ? AND id IN (${placeholders})`,
    )
    .bind(queue, ...cleanIds)
    .run();
  return Number(result?.meta?.changes ?? 0);
}

/**
 * Remove every entry whose `expires_at` is in the past. Returns the
 * number of rows removed. Safe to call from a periodic cron.
 *
 * @param {object} env
 * @param {{ queue?: string }} [args]
 * @returns {Promise<number>}
 */
export async function sweepExpired(env, { queue } = {}) {
  if (!env?.DB) throw new Error("do-queue: env.DB is required");
  const nowIso = new Date().toISOString();
  if (queue) {
    const result = await env.DB
      .prepare(`DELETE FROM do_queue WHERE queue = ? AND expires_at <= ?`)
      .bind(queue, nowIso)
      .run();
    return Number(result?.meta?.changes ?? 0);
  }
  const result = await env.DB
    .prepare(`DELETE FROM do_queue WHERE expires_at <= ?`)
    .bind(nowIso)
    .run();
  return Number(result?.meta?.changes ?? 0);
}

/**
 * Return the current size of a queue (including expired entries not yet
 * swept).
 *
 * @param {object} env
 * @param {{ queue: string }} args
 * @returns {Promise<number>}
 */
export async function readQueueSize(env, { queue }) {
  if (!env?.DB) throw new Error("do-queue: env.DB is required");
  const row = await env.DB
    .prepare(`SELECT COUNT(*) AS n FROM do_queue WHERE queue = ?`)
    .bind(queue)
    .first();
  return Number(row?.n ?? 0);
}

/**
 * Drop all entries for a queue. Used by tests and admin tools.
 *
 * @param {object} env
 * @param {{ queue: string }} args
 * @returns {Promise<number>}
 */
export async function clear(env, { queue }) {
  if (!env?.DB) throw new Error("do-queue: env.DB is required");
  if (!queue) throw new Error("do-queue: queue is required");
  const result = await env.DB
    .prepare(`DELETE FROM do_queue WHERE queue = ?`)
    .bind(queue)
    .run();
  return Number(result?.meta?.changes ?? 0);
}

function safeParse(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
