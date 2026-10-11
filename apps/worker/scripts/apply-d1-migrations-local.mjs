/**
 * Apply apps/worker/db/*.sql to local Miniflare D1.
 * Ignores duplicate-column / already-exists so a DB that already has seq
 * (from an older runtime ALTER) can finish 0211+ without wiping state.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbDir = path.join(root, "db");
const sqliteGlobDir = path.join(root, ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");

const IGNORABLE = [
  "duplicate column name",
  "already exists",
  "duplicate index",
  "index already exists",
];

function isIgnorable(err) {
  const msg = String(err?.message || err).toLowerCase();
  return IGNORABLE.some((needle) => msg.includes(needle));
}

function findLocalSqlite() {
  const files = fs
    .readdirSync(sqliteGlobDir)
    .filter((name) => name.endsWith(".sqlite") && name !== "metadata.sqlite");
  if (files.length !== 1) {
    throw new Error(`expected 1 local D1 sqlite in ${sqliteGlobDir}, found ${files.join(", ") || "none"}`);
  }
  return path.join(sqliteGlobDir, files[0]);
}

function splitSql(source) {
  const withoutBlock = source.replace(/\/\*[\s\S]*?\*\//g, "\n");
  const statements = [];
  let buf = "";
  for (const rawLine of withoutBlock.split("\n")) {
    const line = rawLine.replace(/--.*$/, "");
    buf += `${line}\n`;
    if (buf.trim().endsWith(";")) {
      const sql = buf.trim();
      buf = "";
      if (sql && sql !== ";") statements.push(sql);
    }
  }
  const tail = buf.trim();
  if (tail) statements.push(tail.endsWith(";") ? tail : `${tail};`);
  return statements;
}

function migrationFiles() {
  return fs
    .readdirSync(dbDir)
    .filter((name) => /^\d+.+\.sql$/i.test(name) && name !== "0136_schema.sql")
    .sort((a, b) => a.localeCompare(b));
}

const sqlitePath = findLocalSqlite();
const db = new DatabaseSync(sqlitePath);
db.exec(`CREATE TABLE IF NOT EXISTS d1_migrations(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);`);

const applied = new Set(
  db.prepare("SELECT name FROM d1_migrations").all().map((row) => row.name),
);

let appliedCount = 0;
let skippedCount = 0;
const skippedDupes = [];

for (const name of migrationFiles()) {
  if (applied.has(name)) {
    skippedCount += 1;
    continue;
  }
  const sql = fs.readFileSync(path.join(dbDir, name), "utf8");
  const statements = splitSql(sql);
  const run = db.exec.bind(db);
  try {
    db.exec("BEGIN");
    for (const statement of statements) {
      try {
        db.exec(statement);
      } catch (err) {
        if (!isIgnorable(err)) throw err;
        skippedDupes.push(`${name}: ${err.message}`);
      }
    }
    db.prepare("INSERT INTO d1_migrations (name) VALUES (?)").run(name);
    db.exec("COMMIT");
    appliedCount += 1;
    console.log("applied", name);
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    console.error("failed", name, err.message);
    db.close();
    process.exit(1);
  }
}

db.close();
console.log(
  JSON.stringify(
    { sqlitePath, appliedCount, alreadyApplied: skippedCount, ignorable: skippedDupes },
    null,
    2,
  ),
);
