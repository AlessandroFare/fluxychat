#!/usr/bin/env node
/**
 * Publish all public @fluxy-chat/* packages in dependency order.
 *
 * Usage:
 *   node scripts/publish-packages.mjs --dry-run   # pack + manifest guard only
 *   node scripts/publish-packages.mjs             # pnpm publish (requires npm login)
 *
 * Always run from repo root. Uses `pnpm publish` so workspace: ranges are rewritten.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dryRun = process.argv.includes("--dry-run");
const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

/** Topological publish order */
const PACKAGES = [
  "packages/protocol",
  "packages/config",
  "packages/sdk",
  "packages/react",
  "packages/agent",
  "packages/ui",
  "packages/react-native-sdk",
  "packages/create-fluxy-chat",
];

function run(cmd, args, cwd) {
  console.log(`\n→ ${cmd} ${args.join(" ")}  (${cwd.replace(root + "\\", "").replace(root + "/", "")})`);
  execFileSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
}

function readVersion(rel) {
  const pkg = JSON.parse(readFileSync(join(root, rel, "package.json"), "utf8"));
  return `${pkg.name}@${pkg.version}`;
}

console.log("FluxyChat npm publish");
console.log(`Mode: ${dryRun ? "dry-run (pack + guard)" : "publish"}`);
console.log("Order:", PACKAGES.map((p) => readVersion(p)).join(" → "));

for (const rel of PACKAGES) {
  const cwd = resolve(root, rel);
  if (!existsSync(join(cwd, "package.json"))) {
    console.error(`Missing ${rel}/package.json`);
    process.exit(1);
  }

  run(pnpmCmd, ["run", "build"], cwd);

  if (dryRun) {
    run("node", ["../../scripts/verify-publish-manifest.mjs", "--dry-run"], cwd);
    continue;
  }

  run(pnpmCmd, ["publish", "--access", "public", "--no-git-checks"], cwd);
}

console.log(dryRun ? "\nDry-run complete — manifests clean." : "\nAll packages published.");
