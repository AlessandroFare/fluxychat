#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const distUrl = pathToFileURL(join(here, "../dist/fluxy-migrate.js")).href;

async function load() {
  try {
    return await import(distUrl);
  } catch {
    process.stderr.write(
      "fluxy-migrate needs a built SDK. From the repo: pnpm --filter @fluxy-chat/sdk build\n",
    );
    process.exit(2);
  }
}

function printHelp() {
  process.stdout.write(`fluxy-migrate — map a Pusher/Ably/Stream/PartyKit JSON export to import-chat-history rows.

Usage:
  fluxy-migrate <export.json> [--out rows.json]

Does not scrape vendors. Cap 400 rows. Then:
  FLUXY_WORKER_URL=… FLUXY_ADMIN_JWT=… pnpm import-chat-history rows.json

This is not a live channel proxy.
`);
}

async function main() {
  const argv = process.argv.slice(2);
  if (!argv[0] || argv[0] === "-h" || argv[0] === "--help") {
    printHelp();
    process.exit(argv[0] ? 0 : 2);
  }
  const filePath = argv[0];
  const outIdx = argv.indexOf("--out");
  const outPath = outIdx >= 0 ? argv[outIdx + 1] : "";
  const mod = await load();
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (err) {
    process.stderr.write(`Could not read JSON: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(2);
  }
  const rows = mod.migrateVendorExportToImportRows(parsed);
  const json = `${JSON.stringify(rows, null, 2)}\n`;
  if (outPath) writeFileSync(outPath, json);
  else process.stdout.write(json);
  process.stderr.write(`${rows.length} row(s). Cap 400. Hosted is beta.\n`);
}

void main();
