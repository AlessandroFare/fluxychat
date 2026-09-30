#!/usr/bin/env node
/**
 * Self-host: copy fluxy.config.js `jurisdiction: "eu"` onto wrangler.toml DO bindings.
 * Does not relocate D1. Does not run on hosted FluxyChat Cloud.
 *
 *   node scripts/apply-do-jurisdiction.mjs
 *   node scripts/apply-do-jurisdiction.mjs --write
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { applyWranglerDoJurisdiction } from "@fluxy-chat/config";

const here = dirname(fileURLToPath(import.meta.url));
const workerRoot = join(here, "..");
const write = process.argv.includes("--write");

const configMod = await import(pathToFileURL(join(workerRoot, "fluxy.config.js")).href);
const jurisdiction = configMod.default?.jurisdiction ?? configMod.jurisdiction;
const wranglerPath = join(workerRoot, "wrangler.toml");
const toml = readFileSync(wranglerPath, "utf8");
const next = applyWranglerDoJurisdiction(toml, jurisdiction === "eu" ? "eu" : undefined);

if (write) {
  writeFileSync(wranglerPath, next);
  process.stdout.write(
    `Wrote ${wranglerPath} (jurisdiction=${jurisdiction === "eu" ? "eu" : "unset"}). D1 region is unchanged.\n`,
  );
} else {
  process.stdout.write(next);
  process.stderr.write("Dry run. Pass --write to overwrite wrangler.toml.\n");
}
