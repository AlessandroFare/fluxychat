/**
 * F5 — Room as a database: guarded read-only SQL over the room's own SQLite.
 *
 * THE PITCH
 * ---------
 * Every FluxyChat room IS a SQLite database (new_sqlite_classes). This module
 * lets a customer query it directly: "your chat is a queryable DB, zero ETL".
 * Stream/Sendbird structurally cannot offer this — their storage is opaque.
 *
 * SECURITY MODEL (read-only, hard-validated)
 * ------------------------------------------
 * The room's SQLite holds live product state, so the guard is deliberately
 * paranoid and allow-shaped:
 *   - exactly ONE statement, which MUST start with SELECT or WITH
 *   - any `;` beyond an optional trailing one => reject (multi-statement)
 *   - keyword denylist on known dangerous verbs even inside CTEs
 *     (INSERT/UPDATE/DELETE/DROP/ALTER/CREATE/REPLACE/PRAGMA/ATTACH/DETACH/
 *      VACUUM/REINDEX/ANALYZE) — checked case-insensitively at token starts,
 *   - comment stripping first so `SELECT/*x*&#47;...` cannot smuggle text past
 *     the prefix check,
 *   - row cap enforced by the executor (never by trusting LIMIT).
 */

const FORBIDDEN_VERBS = [
  "insert",
  "update",
  "delete",
  "drop",
  "alter",
  "create",
  "replace",
  "pragma",
  "attach",
  "detach",
  "vacuum",
  "reindex",
  "analyze",
];

/** Strip -- line comments and block comments so prefixes can't be hidden. */
function stripComments(sql) {
  return String(sql)
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ");
}

/**
 * Validate a user-supplied SQL string for read-only execution.
 * @returns {{ ok: true, sql: string } | { ok: false, reason: string }}
 */
export function validateReadOnlySql(input) {
  if (typeof input !== "string" || !input.trim()) {
    return { ok: false, reason: "sql_required" };
  }

  const stripped = stripComments(input).trim();
  if (!stripped) return { ok: false, reason: "sql_empty_after_comments" };

  // Single statement only: one optional trailing semicolon.
  const withoutTrailing = stripped.replace(/;\s*$/, "");
  if (withoutTrailing.includes(";")) {
    return { ok: false, reason: "multiple_statements_forbidden" };
  }

  const upper = withoutTrailing.toUpperCase();
  if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) {
    return { ok: false, reason: "select_only" };
  }

  // Token-start scan: reject forbidden verbs wherever a new SQL word begins,
  // including inside WITH clauses and subqueries.
  const tokens = withoutTrailing.split(/[^A-Za-z_]+/).filter(Boolean);
  for (const tok of tokens) {
    const lower = tok.toLowerCase();
    if (FORBIDDEN_VERBS.includes(lower)) {
      return { ok: false, reason: `forbidden_keyword:${lower}` };
    }
  }

  return { ok: true, sql: withoutTrailing };
}

/**
 * Execute a validated query against a SQLite-like handle with a hard row cap.
 * Works with the Durable Object `storage.sql` shape: exec(sql) returns an
 * iterable of row objects.
 *
 * @param {{ exec: (sql: string) => Iterable<Record<string, unknown>> }} sqlite
 * @param {string} sql  already validated
 * @param {number} maxRows
 */
export function executeReadOnlySql(sqlite, sql, maxRows = 200) {
  if (!sqlite || typeof sqlite.exec !== "function") {
    return { ok: false, reason: "sqlite_unavailable" };
  }
  const cap = Math.min(Math.max(1, Math.floor(maxRows)), 1000);
  const rows = [];
  let truncated = false;
  try {
    for (const row of sqlite.exec(sql)) {
      if (rows.length >= cap) {
        truncated = true;
        break;
      }
      rows.push(row);
    }
  } catch (err) {
    return {
      ok: false,
      reason: "query_failed",
      detail: err instanceof Error ? err.message.slice(0, 200) : "unknown",
    };
  }
  return { ok: true, rows, rowCount: rows.length, truncated };
}
