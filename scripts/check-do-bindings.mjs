#!/usr/bin/env node
/**
 * DO bindings ↔ wrangler migrations check (ENG-12).
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const wranglerPath = resolve(repoRoot, "apps/worker/wrangler.toml");
const workerPath = resolve(repoRoot, "apps/worker/src/worker.js");

function activeTomlLines(toml) {
  return toml
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith("#");
    })
    .join("\n");
}

function parseTomlClasses(toml) {
  const active = activeTomlLines(toml);
  const bindings = [...active.matchAll(/class_name\s*=\s*"([^"]+)"/g)].map((m) => m[1]);
  const sqliteMigrations = [
    ...active.matchAll(/new_sqlite_classes\s*=\s*\["([^"]+)"\]/g),
  ].map((m) => m[1]);
  return { bindings: new Set(bindings), sqliteMigrations: new Set(sqliteMigrations) };
}

function parseWorkerExports(source) {
  const exports = [...source.matchAll(/export\s+\{\s*(\w+)/g)].map((m) => m[1]);
  return new Set(exports);
}

function main() {
  const toml = readFileSync(wranglerPath, "utf8");
  const worker = readFileSync(workerPath, "utf8");
  const { bindings, sqliteMigrations } = parseTomlClasses(toml);
  const exported = parseWorkerExports(worker);

  console.log(`do-bindings: ${bindings.size} wrangler bindings, ${sqliteMigrations.size} sqlite migration classes`);

  const missingExport = [...bindings].filter((c) => !exported.has(c));
  if (missingExport.length) {
    console.error("✗ DO classes bound in wrangler but not exported from worker.js:");
    for (const c of missingExport) console.error(`  - ${c}`);
    process.exit(1);
  }

  const missingMigration = [...bindings].filter((c) => !sqliteMigrations.has(c));
  if (missingMigration.length) {
    console.error("✗ DO bindings without new_sqlite_classes migration (ENG-15 note):");
    for (const c of missingMigration) console.error(`  - ${c}`);
    process.exit(1);
  }

  console.log("✓ DO bindings, exports, and sqlite migrations align");
}

main();
