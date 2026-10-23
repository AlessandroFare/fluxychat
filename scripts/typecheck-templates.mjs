#!/usr/bin/env node
/**
 * Typecheck every create-fluxy-chat gallery template (nightly drift check).
 *
 * The scaffolder smoke verifies that files appear; nothing compiles them, and
 * the templates sit outside the pnpm workspace — so a template can drift
 * against the published @fluxy-chat packages for months without any red build.
 * This script scaffolds each template through the real gallery path
 * (`--example <name>`), installs its dependencies, and runs its type check
 * (`type-check` script when present, otherwise `tsc --noEmit`).
 *
 * Usage:
 *   pnpm run smoke:typecheck-templates                  # all templates
 *   pnpm run smoke:typecheck-templates -- --only react,full
 *   pnpm run smoke:typecheck-templates -- --keep        # keep the temp dir
 *
 * Exit 0 when every template typechecks, 1 otherwise (summary printed).
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = join(root, "packages", "create-fluxy-chat");
const templatesDir = join(pkgDir, "templates");

const cliArgs = process.argv.slice(2);
const onlyIndex = cliArgs.indexOf("--only");
const only = onlyIndex >= 0 ? String(cliArgs[onlyIndex + 1] ?? "").split(",").filter(Boolean) : null;
const keep = cliArgs.includes("--keep");

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    cwd: opts.cwd ?? root,
    encoding: "utf8",
    stdio: "pipe",
    shell: process.platform === "win32",
  });
}

function output(result) {
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
}

function tail(text, lines = 12) {
  return text.split("\n").slice(-lines).join("\n");
}

function newestSourceMtime(dir) {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    newest = Math.max(
      newest,
      entry.isDirectory() ? newestSourceMtime(full) : statSync(full).mtimeMs,
    );
  }
  return newest;
}

function ensureCliBuilt() {
  const dist = join(pkgDir, "dist", "index.js");
  const srcDir = join(pkgDir, "src");
  if (existsSync(dist) && statSync(dist).mtimeMs >= newestSourceMtime(srcDir)) {
    return;
  }
  console.log("→ Building @fluxy-chat/create-fluxy-chat");
  const build = run("pnpm", ["build"], { cwd: pkgDir });
  if (build.status !== 0) {
    throw new Error(`create-fluxy-chat build failed:\n${output(build)}`);
  }
}

/**
 * How a user scaffolds each name. Gallery examples are copied verbatim from
 * `templates/<name>`; the named flows copy or generate their own project. The
 * list is derived from the templates directory, so a folder that no CLI path
 * can scaffold fails loudly instead of being typechecked as if it were real.
 */
const NAMED_FLOWS = {
  react: ["--template", "react"],
  minimal: ["--minimal"],
  full: ["--full"],
  "hr-feedback": ["--template", "hr-feedback"],
  basic: ["--template", "basic"],
  web: ["--template", "web"],
  slack: ["--template", "slack"],
  telegram: ["--template", "telegram"],
  discord: ["--template", "discord"],
};

function templateScaffolds() {
  const names = new Set(
    readdirSync(templatesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  );
  // The web adapter generates its project from templates.ts (no folder).
  names.add("web");
  return [...names]
    .filter((name) => !only || only.includes(name))
    .sort()
    .map((name) => [name, NAMED_FLOWS[name] ?? ["--example", name]]);
}

function typecheckTemplate(name, flowArgs, workDir) {
  const projectName = `fluxy-tpl-${name.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}`;
  const projectDir = join(workDir, projectName);

  // Scaffold through the real CLI path the user takes.
  const scaffold = run(
    "node",
    [join(pkgDir, "dist", "index.js"), projectName, ...flowArgs, "-y", "--skip-install", "--no-git"],
    { cwd: workDir },
  );
  if (scaffold.status !== 0 || !existsSync(join(projectDir, "package.json"))) {
    return { name, status: "scaffold-failed", detail: tail(output(scaffold)) };
  }

  const pkg = JSON.parse(readFileSync(join(projectDir, "package.json"), "utf8"));
  const hasTsconfig = existsSync(join(projectDir, "tsconfig.json"));
  if (!hasTsconfig && !pkg.devDependencies?.typescript) {
    return { name, status: "skipped", detail: "no TypeScript" };
  }

  const install = run("pnpm", ["install", "--ignore-scripts", "--prefer-offline", "--reporter=silent"], {
    cwd: projectDir,
  });
  if (install.status !== 0) {
    return { name, status: "install-failed", detail: tail(output(install)) };
  }

  const typecheckArgs = pkg.scripts?.["type-check"] ? ["run", "type-check"] : ["exec", "tsc", "--noEmit"];
  const typecheck = run("pnpm", typecheckArgs, { cwd: projectDir });
  if (typecheck.status !== 0) {
    return { name, status: "typecheck-failed", detail: tail(output(typecheck), 20) };
  }

  return { name, status: "ok" };
}

function main() {
  ensureCliBuilt();

  const scaffolds = templateScaffolds();
  if (scaffolds.length === 0) {
    throw new Error(only ? `No template matches --only ${only.join(",")}` : "No templates found");
  }
  console.log(`→ Typechecking ${scaffolds.length} template(s)`);

  const workDir = mkdtempSync(join(tmpdir(), "fluxy-template-typecheck-"));
  const results = [];

  try {
    for (const [name, flowArgs] of scaffolds) {
      console.log(`\n→ ${name} (${flowArgs.join(" ")})`);
      const result = typecheckTemplate(name, flowArgs, workDir);
      results.push(result);
      console.log(`  ${result.status === "ok" ? "✓" : "✗"} ${result.status}`);
    }
  } finally {
    if (keep) {
      console.log(`\n(kept work dir: ${workDir})`);
    } else {
      rmSync(workDir, { recursive: true, force: true });
    }
  }

  const failed = results.filter((result) => result.status !== "ok" && result.status !== "skipped");
  const skipped = results.filter((result) => result.status === "skipped");
  console.log("\n— Summary —");
  for (const result of results) {
    console.log(`  ${result.name}: ${result.status}`);
  }
  for (const result of failed) {
    console.log(`\n✗ ${result.name} (${result.status})\n${result.detail}`);
  }

  console.log(
    `\n${failed.length === 0 ? "✓" : "✗"} ${results.length - skipped.length - failed.length}/${results.length - skipped.length} typechecked` +
      (skipped.length ? ` (${skipped.length} skipped)` : ""),
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (err) {
  console.error("\n✗ template typecheck failed");
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
}
