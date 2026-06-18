#!/usr/bin/env node
/**
 * Pre-flight checklist before configuring staging/production (no secrets required).
 * Run: pnpm run check:env
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const checks = [];

function ok(msg) {
  checks.push({ level: "ok", msg });
}

function warn(msg) {
  checks.push({ level: "warn", msg });
}

function fail(msg) {
  checks.push({ level: "fail", msg });
}

function fileExists(rel) {
  return existsSync(resolve(root, rel));
}

function read(rel) {
  return readFileSync(resolve(root, rel), "utf8");
}

// Local dev files
if (fileExists("apps/worker/.dev.vars")) ok("apps/worker/.dev.vars exists");
else warn("apps/worker/.dev.vars missing — run: pnpm run dev:setup");

if (fileExists("apps/dashboard/.env.local")) ok("apps/dashboard/.env.local exists");
else warn("apps/dashboard/.env.local missing — run: pnpm run dev:setup");

if (fileExists("scripts/.provision-secrets.env")) ok("scripts/.provision-secrets.env exists (bootstrap done)");
else warn("scripts/.provision-secrets.env missing — run: pnpm provision:bootstrap after Worker deploy");

// Staging wrangler placeholders
if (fileExists("apps/worker/wrangler.staging.toml")) {
  const staging = read("apps/worker/wrangler.staging.toml");
  if (staging.includes("REPLACE_WITH_")) {
    warn("wrangler.staging.toml still has REPLACE_WITH_* — create staging D1/KV and paste IDs");
  } else {
    ok("wrangler.staging.toml has no REPLACE_WITH_* placeholders");
  }
}

// Production wrangler KV placeholder (from audit)
if (fileExists("apps/worker/wrangler.toml")) {
  const prod = read("apps/worker/wrangler.toml");
  if (/REPLACE_WITH/i.test(prod)) {
    warn("wrangler.toml contains REPLACE_WITH — verify KV/D1 IDs before production deploy");
  } else {
    ok("wrangler.toml has no REPLACE_WITH placeholders");
  }
}

// Dashboard env hints
if (fileExists("apps/dashboard/.env.local")) {
  const local = read("apps/dashboard/.env.local");
  if (local.includes("NEXT_PUBLIC_FLUXYCHAT_CLOUD_URL=")) {
    ok("dashboard .env.local sets NEXT_PUBLIC_FLUXYCHAT_CLOUD_URL");
  } else if (local.includes("NEXT_PUBLIC_FLUXYCHAT_WORKER_URL=")) {
    ok("dashboard .env.local sets NEXT_PUBLIC_FLUXYCHAT_WORKER_URL (local dev)");
  } else {
    warn("dashboard .env.local: set NEXT_PUBLIC_FLUXYCHAT_CLOUD_URL or WORKER_URL");
  }
  if (/FLUXY_CONSOLE_API_KEY=\s*fc_/m.test(local)) ok("FLUXY_CONSOLE_API_KEY present in .env.local");
  else if (process.env.CI) {
    /* skip */
  } else {
    warn("FLUXY_CONSOLE_API_KEY not set — needed for hosted Clerk auto-connect");
  }
}

console.log("\nEnvironment readiness\n");

for (const c of checks) {
  const icon = c.level === "ok" ? "✓" : c.level === "warn" ? "!" : "✗";
  console.log(`  ${icon} ${c.msg}`);
}

const failures = checks.filter((c) => c.level === "fail").length;
const warnings = checks.filter((c) => c.level === "warn").length;

console.log(`\n${checks.filter((c) => c.level === "ok").length} ok, ${warnings} warnings, ${failures} failures`);
console.log("\nFull guide: docs/operations/environment-setup.md\n");

if (failures > 0) process.exit(1);

