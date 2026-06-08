import { describe, expect, it } from "vitest";
import {
  readMigrationHistory,
  readSchemaVersion,
  runStorageMigrations,
} from "./do-sql-migrations.js";

/**
 * Minimal mock of a DO `state` exposing the `storage` shape used by the
 * migration runner (`get`, `put`). Async keys map (D1-style) would also
 * work; the runner only calls these two methods.
 */
function createMockState() {
  /** @type {Map<string, unknown>} */
  const data = new Map();
  return {
    data,
    storage: {
      get: async (k) => data.get(k),
      put: async (k, v) => {
        data.set(k, v);
      },
      delete: async (k) => {
        data.delete(k);
      },
    },
  };
}

describe("do-sql-migrations", () => {
  it("runs pending migrations in order and bumps the schema version", async () => {
    const state = createMockState();
    const log = [];
    const result = await runStorageMigrations(state, [
      { version: 1, name: "init", up: async () => { log.push("v1"); } },
      { version: 2, name: "add_cache", up: async () => { log.push("v2"); } },
      { version: 3, name: "add_presence", up: async () => { log.push("v3"); } },
    ]);
    expect(log).toEqual(["v1", "v2", "v3"]);
    expect(result.version).toBe(3);
    expect(result.applied.map((a) => a.name)).toEqual(["init", "add_cache", "add_presence"]);
    expect(await readSchemaVersion(state)).toBe(3);
  });

  it("is idempotent: a second call is a no-op", async () => {
    const state = createMockState();
    const calls = { v1: 0, v2: 0 };
    const migrations = [
      { version: 1, name: "init", up: async () => { calls.v1 += 1; } },
      { version: 2, name: "add_cache", up: async () => { calls.v2 += 1; } },
    ];
    await runStorageMigrations(state, migrations);
    await runStorageMigrations(state, migrations);
    await runStorageMigrations(state, migrations);
    expect(calls.v1).toBe(1);
    expect(calls.v2).toBe(1);
    expect(await readSchemaVersion(state)).toBe(2);
  });

  it("runs only the migrations with version > current", async () => {
    const state = createMockState();
    const calls = { v1: 0, v2: 0, v3: 0 };
    await runStorageMigrations(state, [
      { version: 1, name: "init", up: async () => { calls.v1 += 1; } },
      { version: 2, name: "add_cache", up: async () => { calls.v2 += 1; } },
    ]);
    // After the first run, add v3 and re-run.
    await runStorageMigrations(state, [
      { version: 1, name: "init", up: async () => { calls.v1 += 1; } },
      { version: 2, name: "add_cache", up: async () => { calls.v2 += 1; } },
      { version: 3, name: "add_presence", up: async () => { calls.v3 += 1; } },
    ]);
    expect(calls).toEqual({ v1: 1, v2: 1, v3: 1 });
  });

  it("sorts unsorted input by version before running", async () => {
    const state = createMockState();
    const log = [];
    const result = await runStorageMigrations(state, [
      { version: 3, name: "c", up: async () => { log.push("c"); } },
      { version: 1, name: "a", up: async () => { log.push("a"); } },
      { version: 2, name: "b", up: async () => { log.push("b"); } },
    ]);
    expect(log).toEqual(["a", "b", "c"]);
    expect(result.version).toBe(3);
  });

  it("recovers from a manual history entry by bumping the version pointer", async () => {
    const state = createMockState();
    await state.storage.put("_schema_version", 2);
    await state.storage.put("_schema_migrations", { init: { version: 1, appliedAt: "x" } });
    // A migration with v2 already recorded; runner should bump pointer and skip.
    const result = await runStorageMigrations(state, [
      { version: 1, name: "init", up: async () => { throw new Error("should not run"); } },
      { version: 2, name: "add_cache", up: async () => { throw new Error("should not run"); } },
    ]);
    expect(result.version).toBe(2);
    expect(result.applied).toEqual([]);
  });

  it("passes the state to up() so migrations can read/write storage", async () => {
    const state = createMockState();
    await runStorageMigrations(state, [
      {
        version: 1,
        name: "seed_presence",
        up: async ({ state: s }) => {
          await s.storage.put("presence", { online: 0 });
        },
      },
    ]);
    expect(await state.storage.get("presence")).toEqual({ online: 0 });
  });

  it("writes the audit history with appliedAt timestamps", async () => {
    const state = createMockState();
    await runStorageMigrations(state, [
      { version: 1, name: "init", up: async () => {} },
    ]);
    const history = await readMigrationHistory(state);
    expect(history.init.version).toBe(1);
    expect(typeof history.init.appliedAt).toBe("string");
    expect(new Date(history.init.appliedAt).toString()).not.toBe("Invalid Date");
  });

  it("rejects migrations with missing or invalid fields", async () => {
    const state = createMockState();
    await expect(runStorageMigrations(state, [
      { version: "1", name: "x", up: () => {} },
    ])).rejects.toThrow(/integer version/);
    await expect(runStorageMigrations(state, [
      { version: 1, up: () => {} },
    ])).rejects.toThrow(/name/);
    await expect(runStorageMigrations(state, [
      { version: 1, name: "x" },
    ])).rejects.toThrow(/up\(\)/);
    await expect(runStorageMigrations(state, null)).rejects.toThrow(/array/);
  });

  it("rejects duplicate version numbers", async () => {
    const state = createMockState();
    await expect(runStorageMigrations(state, [
      { version: 1, name: "a", up: () => {} },
      { version: 1, name: "b", up: () => {} },
    ])).rejects.toThrow(/duplicate migration version 1/);
  });

  it("wraps errors from up() with the migration name + version", async () => {
    const state = createMockState();
    await expect(runStorageMigrations(state, [
      {
        version: 1,
        name: "broken",
        up: async () => { throw new Error("nope"); },
      },
    ])).rejects.toThrow(/broken v1 failed: nope/);
  });

  it("rejects calls without a storage implementation", async () => {
    await expect(runStorageMigrations({}, [])).rejects.toThrow(/state\.storage/);
  });

  it("readSchemaVersion returns 0 for an un-migrated DO", async () => {
    const state = createMockState();
    expect(await readSchemaVersion(state)).toBe(0);
  });

  it("readSchemaVersion returns 0 when state has no storage", async () => {
    expect(await readSchemaVersion({})).toBe(0);
  });
});
