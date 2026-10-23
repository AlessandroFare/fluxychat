#!/usr/bin/env node
/**
 * I4: offline verifier for exported audit files ("fluxy verify").
 *
 * Usage:
 *   node scripts/verify-audit-export.mjs <export.json> [more.json ...]
 *   npm run verify:audit -- receipt.json
 *
 * Accepts either a sealed ops receipt (`?format=receipt` on the ops audit or
 * evidence export routes) or a room audit-chain export. No DB, no network:
 * hashes are recomputed with the same canonical serialization the app used.
 * Exit code 0 = every file valid, 1 = a file was altered, 2 = usage/parse error.
 */
import { readFile } from "node:fs/promises";
import { verifyAuditExport } from "../apps/worker/src/lib/ops-receipts.js";

const files = process.argv.slice(2);
if (!files.length) {
  console.error("Usage: node scripts/verify-audit-export.mjs <export.json> [more.json ...]");
  process.exit(2);
}

let failed = false;
for (const file of files) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(file, "utf8"));
  } catch (err) {
    failed = true;
    console.error(`fluxy verify: ERROR ${file} — ${err.message}`);
    continue;
  }
  const result = await verifyAuditExport(parsed);
  if (!result.ok) {
    failed = true;
    console.error(`fluxy verify: ERROR ${file} — ${result.error}`);
  } else if (result.valid) {
    console.log(`fluxy verify: OK   ${file} — ${result.kind}, ${result.count} records, tip ${result.tipHash}`);
  } else {
    failed = true;
    console.error(`fluxy verify: FAIL ${file} — ${result.kind}, first break at record #${result.firstBreakSeq}`);
  }
}
process.exit(failed ? 1 : 0);
