#!/usr/bin/env node
/**
 * CI filter meta-gate.
 *
 * `pnpm --filter <name> <script>` exits 0 when no workspace project matches the
 * filter. A typo in a package scope therefore turns a CI step into a silent
 * no-op that still reports success. This repo shipped with three such steps
 * (`@fluxychat/...` instead of `@fluxy-chat/...`), which meant the worker
 * typecheck, the protocol build and the dashboard build never ran.
 *
 * This gate parses every `pnpm --filter` invocation out of the workflow files and
 * asserts that each filter resolves to a real package, and that each requested
 * script exists in that package.
 *
 * Run: node scripts/check-ci-filters.mjs
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const workflowsDir = resolve(repoRoot, ".github/workflows");

/** @returns {Map<string, { dir: string, scripts: Record<string, string> }>} */
function loadWorkspacePackages() {
  const packages = new Map();
  // Mirrors pnpm-workspace.yaml: apps/* and packages/*
  for (const group of ["apps", "packages"]) {
    const groupDir = resolve(repoRoot, group);
    if (!existsSync(groupDir)) continue;
    for (const entry of readdirSync(groupDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pkgPath = join(groupDir, entry.name, "package.json");
      if (!existsSync(pkgPath)) continue;
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
        if (pkg.name) {
          packages.set(pkg.name, {
            dir: `${group}/${entry.name}`,
            scripts: pkg.scripts || {},
          });
        }
      } catch {
        /* unreadable package.json is caught by other tooling */
      }
    }
  }
  return packages;
}

/**
 * Extract `--filter <name> <script>` pairs from a workflow file.
 * Handles chained `&&` commands on one line. YAML comment lines are ignored so
 * that prose describing the gate does not trip it.
 * @param {string} yaml
 */
function extractFilterInvocations(yaml) {
  const found = [];
  const re = /pnpm\s+--filter\s+(\S+)\s+([a-zA-Z0-9:_-]+)/g;
  for (const rawLine of yaml.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith("#")) continue;
    for (const match of line.matchAll(re)) {
      found.push({ filter: match[1], script: match[2] });
    }
  }
  return found;
}

function main() {
  const packages = loadWorkspacePackages();
  if (!packages.size) {
    console.error("✗ no workspace packages discovered — check the workspace layout");
    process.exit(1);
  }

  const problems = [];
  let checked = 0;

  const workflowFiles = existsSync(workflowsDir)
    ? readdirSync(workflowsDir).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    : [];

  for (const file of workflowFiles) {
    const yaml = readFileSync(join(workflowsDir, file), "utf8");
    for (const { filter, script } of extractFilterInvocations(yaml)) {
      checked++;
      // Skip pattern filters (globs, path filters, changed-since) — those are
      // legitimately allowed to match zero or many packages.
      if (/[*!.[\]{}]/.test(filter) || filter.startsWith("./")) continue;

      const pkg = packages.get(filter);
      if (!pkg) {
        const suggestion = [...packages.keys()].find(
          (name) => name.replace(/[^a-z0-9]/gi, "") === filter.replace(/[^a-z0-9]/gi, ""),
        );
        problems.push(
          `${file}: filter "${filter}" matches no workspace package` +
            (suggestion ? ` — did you mean "${suggestion}"?` : ""),
        );
        continue;
      }
      if (!pkg.scripts[script]) {
        problems.push(
          `${file}: package "${filter}" has no script "${script}" (${pkg.dir}/package.json)`,
        );
      }
    }
  }

  console.log(
    `ci-filters: ${checked} pnpm --filter invocation(s) across ${workflowFiles.length} workflow file(s), ` +
      `${packages.size} workspace packages`,
  );

  if (problems.length) {
    console.error("✗ CI filter gate failed — these steps would silently no-op:");
    for (const p of problems) console.error(`  - ${p}`);
    console.error(
      "\nWhy this matters: pnpm exits 0 when a filter matches nothing, so the step\n" +
        "reports success while running no code at all.",
    );
    process.exit(1);
  }

  console.log("✓ every CI package filter resolves to a real package and script");
}

main();
