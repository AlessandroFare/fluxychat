#!/usr/bin/env node
/**
 * DX-16.1 — gzip size report for published SDK entrypoints (no browser bundle graph).
 * Writes bundle-size-report.json for CI artifacts / trend tracking.
 */
import { gzipSync } from "node:zlib";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

const ENTRIES = [
  { name: "@fluxy-chat/sdk", path: "packages/sdk/dist/index.js" },
  { name: "@fluxy-chat/sdk/react", path: "packages/sdk/dist/react.js" },
  { name: "@fluxy-chat/sdk/testing", path: "packages/sdk/dist/testing-utils.js" },
  { name: "@fluxy-chat/react", path: "packages/react/dist/index.js" },
];

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} kB`;
}

const rows = [];
let maxGzip = 0;

for (const entry of ENTRIES) {
  const abs = join(root, entry.path);
  if (!existsSync(abs)) {
    console.error(`Missing ${entry.path} — run pnpm --filter @fluxy-chat/sdk build first`);
    process.exit(1);
  }
  const raw = readFileSync(abs);
  const gzip = gzipSync(raw);
  maxGzip = Math.max(maxGzip, gzip.length);
  rows.push({
    package: entry.name,
    file: entry.path,
    rawBytes: raw.length,
    gzipBytes: gzip.length,
    raw: formatKb(raw.length),
    gzip: formatKb(gzip.length),
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  note: "Artifact sizes only — app bundles tree-shake imports. Compare gzip in your bundler for production.",
  entries: rows,
  maxGzipKb: Number((maxGzip / 1024).toFixed(1)),
};

const outPath = join(root, "bundle-size-report.json");
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);

console.log("\nSDK bundle size report\n");
for (const row of rows) {
  console.log(`  ${row.package.padEnd(28)} raw ${row.raw.padStart(8)}  gzip ${row.gzip.padStart(8)}`);
}
console.log(`\n→ wrote ${outPath}\n`);

const budgetKb = Number(process.env.FLUXY_SDK_GZIP_BUDGET_KB ?? "160");
if (maxGzip / 1024 > budgetKb) {
  console.error(`gzip budget exceeded: max entry ${(maxGzip / 1024).toFixed(1)} kB > ${budgetKb} kB`);
  process.exit(1);
}
