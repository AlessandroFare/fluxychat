#!/usr/bin/env node
/**
 * DX-16.1 / PG-P0-1 — gzip size report for published SDK entrypoints.
 * Industry reference: ~14 kB gzip for chat SDK; we gate @fluxy-chat/react at 20 kB.
 */
import { gzipSync } from "node:zlib";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

/** Per-package gzip budgets (kB). Omit to use FLUXY_SDK_GZIP_BUDGET_KB default. */
const ENTRY_BUDGETS_KB = {
  "@fluxy-chat/react": Number(process.env.FLUXY_REACT_GZIP_BUDGET_KB ?? "20"),
  "@fluxy-chat/sdk/react": Number(process.env.FLUXY_REACT_GZIP_BUDGET_KB ?? "20"),
};

const ENTRIES = [
  { name: "@fluxy-chat/sdk", path: "packages/sdk/dist/index.js" },
  { name: "@fluxy-chat/sdk/react", path: "packages/sdk/dist/react.js" },
  { name: "@fluxy-chat/sdk/testing", path: "packages/sdk/dist/testing-utils.js" },
  { name: "@fluxy-chat/react", path: "packages/react/dist/index.js" },
];

const DEFAULT_BUDGET_KB = Number(process.env.FLUXY_SDK_GZIP_BUDGET_KB ?? "160");

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} kB`;
}

const rows = [];
let maxGzip = 0;
let failed = false;

for (const entry of ENTRIES) {
  const abs = join(root, entry.path);
  if (!existsSync(abs)) {
    console.error(`Missing ${entry.path} — run pnpm --filter @fluxy-chat/sdk build first`);
    process.exit(1);
  }
  const raw = readFileSync(abs);
  const gzip = gzipSync(raw);
  maxGzip = Math.max(maxGzip, gzip.length);
  const budgetKb = ENTRY_BUDGETS_KB[entry.name] ?? DEFAULT_BUDGET_KB;
  const gzipKb = gzip.length / 1024;
  const withinBudget = gzipKb <= budgetKb;
  if (!withinBudget) failed = true;
  rows.push({
    package: entry.name,
    file: entry.path,
    rawBytes: raw.length,
    gzipBytes: gzip.length,
    raw: formatKb(raw.length),
    gzip: formatKb(gzip.length),
    budgetKb,
    withinBudget,
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  note: "Artifact sizes only — app bundles tree-shake imports. Industry reference ~14 kB gzip for chat-only React SDK.",
  industryReferenceGzipKb: 14,
  entries: rows,
  maxGzipKb: Number((maxGzip / 1024).toFixed(1)),
};

const outPath = join(root, "bundle-size-report.json");
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);

console.log("\nSDK bundle size report\n");
for (const row of rows) {
  const flag = row.withinBudget ? "✓" : "✗";
  console.log(
    `  ${flag} ${row.package.padEnd(28)} gzip ${row.gzip.padStart(8)}  (budget ${row.budgetKb} kB)`,
  );
}
console.log(`\n→ wrote ${outPath}\n`);

if (failed) {
  console.error("One or more entries exceeded their gzip budget.");
  process.exit(1);
}
