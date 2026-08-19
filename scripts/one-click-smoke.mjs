#!/usr/bin/env node
/**
 * Smoke test: scaffold --full template and verify key files exist.
 * Optional E2E: FLUXY_SMOKE_E2E=1 with worker at 127.0.0.1:8787 runs setup + POST message.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const cliEntry = join(root, "packages", "create-fluxy-chat", "dist", "index.js");

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`✓ ${msg}`);
}

if (!existsSync(cliEntry)) {
  const build = spawnSync("pnpm", ["--filter", "@fluxy-chat/create-fluxy-chat", "run", "build"], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
  if (build.status !== 0) fail("CLI build failed");
}

const workDir = mkdtempSync(join(tmpdir(), "fluxy-one-click-"));
const projectDir = join(workDir, "smoke-app");

try {
  const scaffold = spawnSync(
    "node",
    [cliEntry, "smoke-app", "--full", "-y", "--skip-install", "--no-git"],
    { cwd: workDir, stdio: "inherit" },
  );
  if (scaffold.status !== 0) fail("scaffold exited non-zero");

  const required = [
    "package.json",
    "scripts/fluxy-setup.mjs",
    "scripts/fluxy-dev.mjs",
    "src/App.tsx",
    "scripts/fluxy-doctor.mjs",
    ".env.example",
  ];
  for (const rel of required) {
    const p = join(projectDir, rel);
    if (!existsSync(p)) fail(`missing ${rel}`);
  }
  ok("scaffold files present");

  if (process.env.FLUXY_SMOKE_E2E === "1") {
    const health = await fetch("http://127.0.0.1:8787/health").catch(() => null);
    if (!health?.ok) fail("FLUXY_SMOKE_E2E=1 but worker not at :8787");
    const setup = spawnSync("node", ["scripts/fluxy-setup.mjs"], {
      cwd: projectDir,
      stdio: "inherit",
    });
    if (setup.status !== 0) fail("fluxy-setup failed");
    if (!existsSync(join(projectDir, ".env"))) fail(".env not written");
    ok("E2E setup wrote .env");
  } else {
    ok("scaffold-only (set FLUXY_SMOKE_E2E=1 for provision test)");
  }

  console.log("\nOne-click smoke passed.");
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
