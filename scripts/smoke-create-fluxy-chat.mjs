#!/usr/bin/env node
/**
 * Smoke test for `create-fluxy-chat` default template (DX-3).
 *
 * Builds the CLI package, scaffolds a project non-interactively, and verifies
 * the expected files exist. Does not run `pnpm install` or start wrangler.
 *
 * Usage:
 *   pnpm smoke:create-fluxy-chat
 *
 * Exit 0 on success, 1 on failure.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = join(root, "packages", "create-fluxy-chat");
const projectName = "fluxy-smoke-test-bot";

function run(cmd, args, opts = {}) {
  const useShell = process.platform === "win32";
  const executable = useShell ? cmd : cmd;
  const result = spawnSync(executable, args, {
    cwd: opts.cwd ?? root,
    encoding: "utf8",
    stdio: opts.silent ? "pipe" : "inherit",
    shell: useShell,
  });
  if (result.status !== 0) {
    const detail = result.stderr?.trim() || result.stdout?.trim() || `exit ${result.status ?? "null"}`;
    throw new Error(`${cmd} ${args.join(" ")} failed: ${detail}`);
  }
  return result;
}

function assertFile(projectDir, relPath) {
  const full = join(projectDir, relPath);
  if (!existsSync(full)) {
    throw new Error(`Missing expected file: ${relPath}`);
  }
}

function assertContains(projectDir, relPath, needle) {
  const content = readFileSync(join(projectDir, relPath), "utf8");
  if (!content.includes(needle)) {
    throw new Error(`Expected "${relPath}" to contain: ${needle}`);
  }
}

function scaffoldAndAssert(workDir, projectName, cliArgs, expectedFiles, contentChecks = []) {
  console.log(`→ Scaffolding "${projectName}" (${cliArgs.join(" ")})`);
  run(
    "node",
    [join(pkgDir, "dist", "index.js"), projectName, ...cliArgs],
    { cwd: workDir, silent: true },
  );

  const projectDir = join(workDir, projectName);
  if (!existsSync(projectDir)) {
    throw new Error(`Project directory was not created: ${projectDir}`);
  }

  const entries = readdirSync(projectDir);
  if (entries.length < 3) {
    throw new Error(`Project directory looks empty (${entries.length} entries)`);
  }

  for (const file of expectedFiles) {
    assertFile(projectDir, file);
  }
  for (const [relPath, needle] of contentChecks) {
    assertContains(projectDir, relPath, needle);
  }

  console.log(`  ✓ ${projectName}: ${entries.length} top-level entries`);
  return projectDir;
}

function ensureCliBuilt() {
  const dist = join(pkgDir, "dist", "index.js");
  const src = join(pkgDir, "src", "index.ts");
  if (
    existsSync(dist) &&
    existsSync(src) &&
    statSync(dist).mtimeMs >= statSync(src).mtimeMs
  ) {
    console.log("→ Using existing create-fluxy-chat build");
    return;
  }
  console.log("\n→ Building @fluxy-chat/create-fluxy-chat");
  run("pnpm", ["build"], { cwd: pkgDir });
}

function main() {
  ensureCliBuilt();

  const workDir = mkdtempSync(join(tmpdir(), "fluxy-create-smoke-"));

  try {
    scaffoldAndAssert(
      workDir,
      projectName,
      ["-y", "--skip-install", "--no-git", "--adapter", "basic"],
      [
        "package.json",
        "wrangler.toml",
        ".dev.vars",
        ".env.example",
        ".gitignore",
        "README.md",
        "src/index.ts",
        "src/bot.ts",
        "tsconfig.json",
      ],
      [
        ["package.json", projectName],
        ["wrangler.toml", "name"],
        ["src/index.ts", "export default"],
        ["src/bot.ts", "handleWebhook"],
      ],
    );

    scaffoldAndAssert(
      workDir,
      "fluxy-smoke-test-react",
      ["-y", "--skip-install", "--no-git", "--template", "react"],
      [
        "package.json",
        ".env.example",
        "README.md",
        "src/App.tsx",
        "src/main.tsx",
        "vite.config.ts",
        "index.html",
      ],
      [
        ["src/App.tsx", "joinPublicRoomAsGuest"],
        [".env.example", "VITE_FLUXYCHAT_PUBLIC_ROOM_ID"],
      ],
    );

    scaffoldAndAssert(
      workDir,
      "fluxy-smoke-test-full",
      ["-y", "--skip-install", "--no-git", "--full"],
      [
        "package.json",
        ".env.example",
        "README.md",
        "src/App.tsx",
        "scripts/fluxy-setup.mjs",
        "scripts/fluxy-dev.mjs",
        "scripts/fluxy-doctor.mjs",
        ".fluxy/mode",
        "vite.config.ts",
      ],
      [
        ["src/App.tsx", "invokeAgent"],
        ["package.json", '"setup:hosted"'],
        [".fluxy/mode", "local"],
      ],
    );

    scaffoldAndAssert(
      workDir,
      "fluxy-smoke-test-hosted",
      ["-y", "--skip-install", "--no-git", "--mode", "hosted"],
      [
        "package.json",
        "scripts/fluxy-setup.mjs",
        ".fluxy/mode",
      ],
      [[".fluxy/mode", "hosted"]],
    );

    console.log("\n✓ create-fluxy-chat smoke test passed");
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

try {
  main();
} catch (err) {
  console.error("\n✗ create-fluxy-chat smoke test failed");
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
}
