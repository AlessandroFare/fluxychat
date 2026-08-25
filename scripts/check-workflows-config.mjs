#!/usr/bin/env node
/**
 * Production schedules today are Worker cron (`[triggers] crons` in wrangler.toml).
 * Cloudflare Workflows are optional. If WORKFLOW_SCHEDULES_ENABLED=true, the
 * [[workflows]] binding MUST be uncommented — otherwise cron is silently skipped
 * in worker.js while nothing else runs the jobs.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const wranglerPath = resolve(dirname(fileURLToPath(import.meta.url)), "../apps/worker/wrangler.toml");
const toml = readFileSync(wranglerPath, "utf8");

const enabled = /^\s*WORKFLOW_SCHEDULES_ENABLED\s*=\s*"true"/m.test(toml);
const bindingLive = /^\s*\[\[workflows\]\]/m.test(toml);

if (enabled && !bindingLive) {
  console.error(
    "✗ WORKFLOW_SCHEDULES_ENABLED=true but [[workflows]] is commented out in wrangler.toml.\n" +
      "  Either uncomment the FluxyScheduledWorkflow binding or set WORKFLOW_SCHEDULES_ENABLED=false\n" +
      "  (legacy Worker cron remains the production path).",
  );
  process.exit(1);
}

if (!enabled && bindingLive) {
  console.error(
    "✗ [[workflows]] is bound but WORKFLOW_SCHEDULES_ENABLED is not true — jobs would double-run or conflict.",
  );
  process.exit(1);
}

console.log(
  enabled
    ? "✓ Workflows enabled and [[workflows]] binding is live"
    : "✓ Production schedules: Worker cron; Workflows opt-in (disabled, binding commented)",
);
