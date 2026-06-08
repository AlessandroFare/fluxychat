/**
 * Lightweight KV-storage migration runner for Durable Objects.
 *
 * Why this exists
 * ───────────────
 * FluxyChat's room DOs persist hot state via `ctx.storage` (key-value) and
 * occasionally via D1 (cold storage). Both shapes evolve: presence maps
 * are introduced, the cache key changes, the per-room flag set grows, etc.
 * Without a runner, every shape change risks:
 *
 *   - silent partial updates (a DO with old `state` in `ctx.storage`
 *     running the new code reads the wrong defaults);
 *   - ad-hoc `if (stored === undefined) ...` branches scattered through
 *     the constructor;
 *   - no audit trail ("which DOs are still on v3?").
 *
 * `runStorageMigrations` provides a tiny, ordered, idempotent migration
 * runner with a version counter and a name→record history. It does not
 * require `ctx.storage.sql` (DO SQLite) and is safe to wire in
 * preemptively even before the hot-state→SQL migration lands.
 *
 * Migrations live in `migrations[]` and look like:
 *   { version: 2, name: "add_presence_map", up: async ({ state }) => { ... } }
 *
 * The runner is **idempotent** and **re-entrant**: a DO that is briefly
 * rehydrated mid-migration picks up at the next pending version (the
 * version key is only written after `up()` resolves).
 *
 * Wiring (inside a DO constructor):
 *   this._migrated = this.state.blockConcurrencyWhile(async () => {
 *     await runStorageMigrations(this.state, ROOM_DO_MIGRATIONS);
 *   });
 */

const SCHEMA_VERSION_KEY = "_schema_version";
const MIGRATIONS_HISTORY_KEY = "_schema_migrations";

/**
 * Run pending migrations in ascending version order.
 *
 * @param {import("@cloudflare/workers-types").DurableObjectState} state
 * @param {Array<{ version: number, name: string, up: (ctx: { state: import("@cloudflare/workers-types").DurableObjectState }) => Promise<void> | void }>} migrations
 * @returns {Promise<{ version: number, applied: Array<{ name: string, version: number }>, history: Record<string, { version: number, appliedAt: string }> }>}
 */
export async function runStorageMigrations(state, migrations = []) {
  if (!state?.storage) {
    throw new Error("do-sql-migrations: state.storage is required");
  }
  if (!Array.isArray(migrations)) {
    throw new Error("do-sql-migrations: migrations must be an array");
  }

  for (const m of migrations) {
    if (typeof m?.version !== "number" || !Number.isInteger(m.version) || m.version < 1) {
      throw new Error(`do-sql-migrations: migration must have an integer version >= 1 (got: ${String(m?.version)})`);
    }
    if (typeof m?.name !== "string" || !m.name) {
      throw new Error(`do-sql-migrations: migration must have a non-empty name (version ${m.version})`);
    }
    if (typeof m?.up !== "function") {
      throw new Error(`do-sql-migrations: migration must have an up() function (${m.name} v${m.version})`);
    }
  }

  // Detect duplicate version numbers (would make ordering non-deterministic).
  const seenVersions = new Set();
  for (const m of migrations) {
    if (seenVersions.has(m.version)) {
      throw new Error(`do-sql-migrations: duplicate migration version ${m.version}`);
    }
    seenVersions.add(m.version);
  }

  const sorted = [...migrations].sort((a, b) => a.version - b.version);
  const currentVersion = Number((await state.storage.get(SCHEMA_VERSION_KEY)) ?? 0);
  const history = (await state.storage.get(MIGRATIONS_HISTORY_KEY)) || {};

  const applied = [];
  for (const m of sorted) {
    if (m.version <= currentVersion) continue;
    if (history[m.name] && history[m.name].version === m.version) {
      // Already ran (manual recovery scenario): bump the version pointer.
      await state.storage.put(SCHEMA_VERSION_KEY, m.version);
      continue;
    }

    try {
      await m.up({ state });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`do-sql-migrations: migration ${m.name} v${m.version} failed: ${message}`);
    }

    const nextHistory = {
      ...history,
      [m.name]: { version: m.version, appliedAt: new Date().toISOString() },
    };
    await state.storage.put(MIGRATIONS_HISTORY_KEY, nextHistory);
    await state.storage.put(SCHEMA_VERSION_KEY, m.version);
    applied.push({ name: m.name, version: m.version });
  }

  const finalVersion = Number((await state.storage.get(SCHEMA_VERSION_KEY)) ?? 0);
  return { version: finalVersion, applied, history: (await state.storage.get(MIGRATIONS_HISTORY_KEY)) || {} };
}

/**
 * Read the current schema version from a DO's `ctx.storage`. Returns 0 if
 * the DO has never been migrated.
 *
 * @param {import("@cloudflare/workers-types").DurableObjectState} state
 * @returns {Promise<number>}
 */
export async function readSchemaVersion(state) {
  if (!state?.storage) return 0;
  return Number((await state.storage.get(SCHEMA_VERSION_KEY)) ?? 0);
}

/**
 * Read the full migration history (a name → `{ version, appliedAt }` map).
 *
 * @param {import("@cloudflare/workers-types").DurableObjectState} state
 * @returns {Promise<Record<string, { version: number, appliedAt: string }>>}
 */
export async function readMigrationHistory(state) {
  if (!state?.storage) return {};
  return (await state.storage.get(MIGRATIONS_HISTORY_KEY)) || {};
}

// Keys are exported for tests / admin tools that need to inspect storage.
export const SCHEMA_VERSION_STORAGE_KEY = SCHEMA_VERSION_KEY;
export const MIGRATIONS_HISTORY_STORAGE_KEY = MIGRATIONS_HISTORY_KEY;
