#!/usr/bin/env node
/**
 * Validates .upptime/config.json — CI gate for #62 status page.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const configPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".upptime", "config.json");

function fail(message) {
  console.error(`[upptime] ${message}`);
  process.exit(1);
}

let config;
try {
  config = JSON.parse(readFileSync(configPath, "utf8"));
} catch (err) {
  fail(`Could not read ${configPath}: ${err instanceof Error ? err.message : err}`);
}

const errors = [];

if (!config.owner?.trim()) errors.push("owner is required");
if (!config.repo?.trim()) errors.push("repo is required");

if (!Array.isArray(config.sites) || config.sites.length === 0) {
  errors.push("sites must be a non-empty array");
} else {
  for (const site of config.sites) {
    if (!site.name?.trim()) errors.push("each site needs name");
    if (!site.url?.trim()) errors.push(`site "${site.name ?? "?"}" needs url`);
    else {
      try {
        const u = new URL(site.url);
        if (u.protocol !== "https:") errors.push(`site "${site.name}" must use https`);
      } catch {
        errors.push(`site "${site.name}" has invalid url: ${site.url}`);
      }
    }
    const interval = Number(site.interval);
    if (!Number.isFinite(interval) || interval < 1) {
      errors.push(`site "${site.name}" interval must be >= 1 minute`);
    }
  }
}

const statusSite = config["status-website"];
if (!statusSite?.cname?.trim()) errors.push("status-website.cname is required");
if (!statusSite?.name?.trim()) errors.push("status-website.name is required");

if (errors.length > 0) {
  console.error("[upptime] Config validation failed:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`[upptime] Config OK — ${config.sites.length} site(s), cname=${statusSite.cname}`);
