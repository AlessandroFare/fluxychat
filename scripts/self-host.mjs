#!/usr/bin/env node
/**
 * One-command local self-host bootstrap:
 * install deps, dev env files, D1 migrations (local), worker + dashboard hints.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const WORKER = path.join(ROOT, "apps/worker");

function run(cmd, args, cwd = ROOT) {
  console.log(`\n> ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("FluxyChat self-host bootstrap\n");

if (!fs.existsSync(path.join(ROOT, "node_modules"))) {
  run("pnpm", ["install"]);
}

run("pnpm", ["run", "dev:setup"]);

const wrangler = path.join(WORKER, "node_modules", ".bin", process.platform === "win32" ? "wrangler.cmd" : "wrangler");
if (fs.existsSync(wrangler)) {
  run(wrangler, ["d1", "migrations", "apply", "fluxychat", "--local"], WORKER);
} else {
  run("pnpm", ["exec", "wrangler", "d1", "migrations", "apply", "fluxychat", "--local"], WORKER);
}

console.log(`
Done. Next steps:

  1. Worker:  pnpm --filter @fluxy-chat/worker dev
  2. Dashboard (optional): pnpm --filter dashboard dev
  3. First message smoke: pnpm run first-message

Docs: apps/docs/content/docs/guides/self-host-one-command.mdx
`);
