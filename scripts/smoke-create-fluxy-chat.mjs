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
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = join(root, "packages", "create-fluxy-chat");
const projectName = "fluxy-smoke-test-bot";

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: opts.cwd ?? root,
    encoding: "utf8",
    stdio: opts.silent ? "pipe" : "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    const detail = result.stderr?.trim() || result.stdout?.trim() || `exit ${result.status}`;
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

function main() {
  console.log("\n→ Building @fluxy-chat/create-fluxy-chat");
  run("pnpm", ["--filter", "@fluxy-chat/create-fluxy-chat", "build"]);

  const workDir = mkdtempSync(join(tmpdir(), "fluxy-create-smoke-"));
  const projectDir = join(workDir, projectName);

  try {
    console.log(`→ Scaffolding "${projectName}" (basic adapter, skip install/git)`);
    run(
      "node",
      [join(pkgDir, "dist", "index.js"), projectName, "-y", "--skip-install", "--no-git", "--adapter", "basic"],
      { cwd: workDir, silent: true },
    );

    if (!existsSync(projectDir)) {
      throw new Error(`Project directory was not created: ${projectDir}`);
    }

    const entries = readdirSync(projectDir);
    if (entries.length < 4) {
      throw new Error(`Project directory looks empty (${entries.length} entries)`);
    }

    for (const file of [
      "package.json",
      "wrangler.toml",
      ".dev.vars",
      ".env.example",
      ".gitignore",
      "README.md",
      "src/index.ts",
      "src/bot.ts",
      "tsconfig.json",
    ]) {
      assertFile(projectDir, file);
    }

    assertContains(projectDir, "package.json", projectName);
    assertContains(projectDir, "wrangler.toml", "name");
    assertContains(projectDir, "src/index.ts", "export default");
    assertContains(projectDir, "src/bot.ts", "handleWebhook");

    console.log("\n✓ create-fluxy-chat smoke test passed");
    console.log(`  scaffolded ${entries.length} top-level entries in ${projectDir}`);
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
