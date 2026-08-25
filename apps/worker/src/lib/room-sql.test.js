/**
 * F5 room-as-database — read-only SQL guard tests.
 *
 * This validator is the security boundary between a tenant and the room's live
 * SQLite. Every mutation vector we could think of must be rejected; plain
 * SELECT/WITH queries must pass untouched.
 */
import { describe, expect, it } from "vitest";
import { validateReadOnlySql, executeReadOnlySql } from "./room-sql.js";

describe("validateReadOnlySql — allowed shapes", () => {
  it("accepts plain SELECT", () => {
    expect(validateReadOnlySql("SELECT * FROM messages")).toEqual({
      ok: true,
      sql: "SELECT * FROM messages",
    });
  });

  it("accepts case-insensitive select", () => {
    expect(validateReadOnlySql("select count(*) from rooms").ok).toBe(true);
  });

  it("accepts WITH/CTE queries", () => {
    const res = validateReadOnlySql(
      "WITH t AS (SELECT id FROM messages) SELECT * FROM t",
    );
    expect(res.ok).toBe(true);
  });

  it("tolerates a single trailing semicolon (stripped)", () => {
    expect(validateReadOnlySql("SELECT 1;").sql).toBe("SELECT 1");
  });

  it("strips comments before validating, allowing commented-out verbs", () => {
    // The DELETE lives inside a comment: harmless.
    const res = validateReadOnlySql(
      "SELECT 1 -- DELETE FROM users\nFROM messages",
    );
    expect(res.ok).toBe(true);
    expect(res.sql).not.toContain("--");
  });
});

describe("validateReadOnlySql — mutations rejected", () => {
  it.each([
    "INSERT INTO messages VALUES (1)",
    "UPDATE messages SET content = 'x'",
    "DELETE FROM messages",
    "DROP TABLE messages",
    "ALTER TABLE messages ADD COLUMN x",
    "CREATE TABLE evil (id INT)",
    "REPLACE INTO messages VALUES (1)",
    "PRAGMA table_info(messages)",
    "ATTACH DATABASE 'x' AS y",
    "DETACH DATABASE y",
    "VACUUM",
    "REINDEX messages",
    "ANALYZE",
  ])("rejects %s", (stmt) => {
    const res = validateReadOnlySql(stmt);
    expect(res.ok).toBe(false);
  });

  it("rejects forbidden verbs hidden in CTE bodies", () => {
    const res = validateReadOnlySql(
      "WITH s AS (DELETE FROM messages RETURNING *) SELECT * FROM s",
    );
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("forbidden_keyword:delete");
  });

  it("rejects multiple statements even when both look read-only", () => {
    expect(validateReadOnlySql("SELECT 1; SELECT 2").reason).toBe(
      "multiple_statements_forbidden",
    );
  });

  it("rejects trailing-garbage smuggling via extra semicolon", () => {
    expect(validateReadOnlySql("SELECT 1; DROP TABLE messages").ok).toBe(false);
  });

  it("does not let comment tricks bypass the SELECT prefix", () => {
    expect(validateReadOnlySql("/* hi */ DELETE FROM messages").ok).toBe(false);
    expect(validateReadOnlySql("-- nope\nPRAGMA data_version").ok).toBe(false);
  });

  it("rejects non-SELECT openers like EXPLAIN or VALUES", () => {
    // EXPLAIN can profile internals; keep the surface minimal.
    expect(validateReadOnlySql("EXPLAIN QUERY PLAN SELECT 1").ok).toBe(false);
    expect(validateReadOnlySql("VALUES (1)").ok).toBe(false);
  });
});

describe("validateReadOnlySql — input hygiene", () => {
  it("rejects missing / empty / comment-only input", () => {
    expect(validateReadOnlySql(undefined).ok).toBe(false);
    expect(validateReadOnlySql("").reason).toBe("sql_required");
    expect(validateReadOnlySql("   ").ok).toBe(false);
    expect(validateReadOnlySql("-- just a comment").reason).toBe(
      "sql_empty_after_comments",
    );
    expect(validateReadOnlySql(42).ok).toBe(false);
  });
});

describe("executeReadOnlySql", () => {
  function fakeSqlite(rows, opts = {}) {
    return {
      exec(sql) {
        if (opts.throwOnExec) throw new Error(opts.throwOnExec);
        return rows;
      },
    };
  }

  it("returns rows up to the cap and flags truncation", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ i }));
    const res = executeReadOnlySql(fakeSqlite(rows), "SELECT * FROM t", 4);
    expect(res.ok).toBe(true);
    expect(res.rowCount).toBe(4);
    expect(res.truncated).toBe(true);
  });

  it("no truncation flag under the cap", () => {
    const res = executeReadOnlySql(fakeSqlite([{ a: 1 }]), "SELECT 1", 100);
    expect(res.ok).toBe(true);
    expect(res.truncated).toBe(false);
    expect(res.rows).toEqual([{ a: 1 }]);
  });

  it("caps maxRows at the hard limit of 1000 regardless of caller input", () => {
    const rows = Array.from({ length: 1500 }, (_, i) => ({ i }));
    const res = executeReadOnlySql(fakeSqlite(rows), "SELECT 1", 999_999);
    expect(res.rowCount).toBe(1000);
    expect(res.truncated).toBe(true);
  });

  it("surfaces query errors without leaking stacks beyond 200 chars", () => {
    const res = executeReadOnlySql(
      fakeSqlite([], { throwOnExec: "x".repeat(500) }),
      "SELECT boom",
    );
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("query_failed");
    expect(res.detail.length).toBeLessThanOrEqual(200);
  });

  it("reports sqlite_unavailable on cold DO stubs", () => {
    expect(executeReadOnlySql(null, "SELECT 1").reason).toBe("sqlite_unavailable");
    expect(executeReadOnlySql({}, "SELECT 1").reason).toBe("sqlite_unavailable");
  });
});