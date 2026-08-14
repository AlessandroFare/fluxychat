#!/usr/bin/env node
/**
 * Publish all public @fluxy-chat/* packages in dependency order.
 *
 * Usage:
 *   node scripts/publish-packages.mjs --dry-run
 *   node scripts/publish-packages.mjs
 *   node scripts/publish-packages.mjs --only=sdk,create-fluxy-chat
 *
 * Via pnpm use `--` so args reach the script (commas are preserved):
 *   pnpm run publish:packages -- --only=sdk,create-fluxy-chat
 *
 * OTP: prompted immediately before each publish, passed as `pnpm publish --otp=…`
 * (see https://pnpm.io/cli/publish). Wait ~30 min if you see E429 "rate limited otp".
 *
 * Skips packages whose exact name@version is already on the npm registry.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { join, resolve } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dryRun = process.argv.includes("--dry-run");
const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

const onlyArg = process.argv.find((a) => a.startsWith("--only="));

function parseOnlyFilter(raw) {
  if (!raw) return null;
  const tokens = raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return tokens.length ? new Set(tokens) : null;
}

const onlyFilter = parseOnlyFilter(onlyArg?.slice("--only=".length));

/** Topological publish order */
const PACKAGES = [
  "packages/protocol",
  "packages/config",
  "packages/sdk",
  "packages/react",
  "packages/agent",
  "packages/ui",
  "packages/ui-kit",
  "packages/react-native-sdk",
  "packages/create-fluxy-chat",
];

function run(cmd, args, cwd, extraEnv = {}) {
  const rel = cwd.replace(root + "\\", "").replace(root + "/", "");
  console.log(`\n→ ${cmd} ${args.join(" ")}  (${rel})`);
  execFileSync(cmd, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...extraEnv },
  });
}

function readPkg(rel) {
  return JSON.parse(readFileSync(join(root, rel, "package.json"), "utf8"));
}

function readVersionLabel(rel) {
  const pkg = readPkg(rel);
  return `${pkg.name}@${pkg.version}`;
}

function packageMatchesFilter(rel, pkg) {
  if (!onlyFilter) return true;
  const short = rel.replace(/^packages\//, "");
  return (
    onlyFilter.has(short) ||
    onlyFilter.has(pkg.name) ||
    onlyFilter.has(pkg.name.replace("@fluxy-chat/", ""))
  );
}

function isPublishedOnNpm(name, version) {
  try {
    const out = execFileSync(npmCmd, ["view", `${name}@${version}`, "version"], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      shell: process.platform === "win32",
    }).trim();
    return out === version;
  } catch {
    return false;
  }
}

async function promptOtp(label) {
  const rl = createInterface({ input, output });
  try {
    console.log("\n--- npm 2FA ---");
    console.log("Open your authenticator app (Google Authenticator, Authy, …).");
    console.log("Use a fresh 6-digit code — they expire every ~30 seconds.");
    const code = await rl.question(`OTP for ${label}: `);
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      throw new Error("OTP must be exactly 6 digits.");
    }
    return trimmed;
  } finally {
    rl.close();
  }
}

console.log("FluxyChat npm publish");
console.log(`Mode: ${dryRun ? "dry-run (pack + guard)" : "publish"}`);
if (onlyFilter) {
  console.log(`Filter: ${[...onlyFilter].join(", ")}`);
}
console.log("Order:", PACKAGES.map((p) => readVersionLabel(p)).join(" → "));

/** @type {{ rel: string, cwd: string, pkg: { name: string, version: string } }[]} */
const queue = [];
let skipped = 0;

for (const rel of PACKAGES) {
  const cwd = resolve(root, rel);
  if (!existsSync(join(cwd, "package.json"))) {
    console.error(`Missing ${rel}/package.json`);
    process.exit(1);
  }

  const pkg = readPkg(rel);
  if (!packageMatchesFilter(rel, pkg)) {
    console.log(`\n⊘ skip filter ${pkg.name}@${pkg.version}`);
    continue;
  }

  if (!dryRun && isPublishedOnNpm(pkg.name, pkg.version)) {
    console.log(`\n⊘ skip registry ${pkg.name}@${pkg.version} (already published)`);
    skipped += 1;
    continue;
  }

  queue.push({ rel, cwd, pkg });
}

console.log(`\nBuild phase (${queue.length} package(s))…`);

for (const { rel, cwd, pkg } of queue) {
  run(pnpmCmd, ["run", "build"], cwd);

  if (dryRun) {
    run("node", ["../../scripts/verify-publish-manifest.mjs", "--dry-run"], cwd);
  }
}

if (dryRun) {
  console.log("\nDry-run complete — manifests clean.");
  process.exit(0);
}

let published = 0;

for (const { cwd, pkg } of queue) {
  run("node", ["../../scripts/verify-publish-manifest.mjs"], cwd);

  const otp = await promptOtp(`${pkg.name}@${pkg.version}`);
  run(pnpmCmd, [
    "publish",
    "--access",
    "public",
    "--no-git-checks",
    "--ignore-scripts",
    `--otp=${otp}`,
  ], cwd);
  published += 1;
}

console.log(`\nDone. Published ${published}, skipped ${skipped} (already on registry).`);
