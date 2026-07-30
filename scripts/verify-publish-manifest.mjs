#!/usr/bin/env node
/**
 * prepublishOnly guard: refuse publish if packed manifest still contains "workspace:" ranges.
 * Pattern from Portal SDK — npm publish does not rewrite workspace: protocol.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pkgName = process.env.npm_package_name ?? "this package";
const cwd = process.cwd();

const dryRun =
  process.argv.includes("--dry-run") || process.env.FLUXY_PUBLISH_GUARD_DRY === "1";

/** Collect `./dist/foo.js` paths from package.json exports (nested conditions). */
function collectExportFilePaths(exportsField, out = []) {
  if (!exportsField) return out;
  if (typeof exportsField === "string") {
    if (exportsField.startsWith("./")) out.push(exportsField);
    return out;
  }
  if (typeof exportsField !== "object") return out;
  for (const [key, val] of Object.entries(exportsField)) {
    if (key === "types" || key === "import" || key === "require" || key === "default") {
      if (typeof val === "string" && val.startsWith("./")) out.push(val);
    } else if (key.startsWith(".")) {
      collectExportFilePaths(val, out);
    }
  }
  return out;
}

function fail(reason) {
  console.error(
    `\npublish guard failed for ${pkgName}: ${reason}\nUse \`pnpm publish\` from the package directory.\n`,
  );
  process.exit(1);
}

const userAgent = process.env.npm_config_user_agent ?? "";
if (!dryRun && !userAgent.startsWith("pnpm/")) {
  fail(
    `must run via "pnpm publish" (detected: "${userAgent || "unknown"}"). npm does not rewrite workspace: ranges.`,
  );
}

const pkgJsonPath = join(cwd, "package.json");
if (!existsSync(pkgJsonPath)) {
  fail("package.json not found in cwd");
}

const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
if (pkg.private) {
  console.log(`publish guard: ${pkgName} is private — skip.`);
  process.exit(0);
}

const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const dir = mkdtempSync(join(tmpdir(), "fluxy-publish-guard-"));
try {
  execFileSync(pnpmCmd, ["pack", "--pack-destination", dir], {
    stdio: "pipe",
    cwd,
    shell: process.platform === "win32",
  });
  const tarball = readdirSync(dir).find((f) => f.endsWith(".tgz"));
  if (!tarball) fail("pnpm pack did not produce a tarball");

  const manifestPath = `package/package.json`;
  let manifest = "";
  try {
    manifest = execFileSync("tar", ["xOzf", join(dir, tarball), manifestPath], {
      encoding: "utf8",
    });
  } catch {
    fail("could not read package.json from tarball (is tar available?)");
  }

  const offending = manifest.split("\n").filter((line) => line.includes('"workspace:'));
  if (offending.length > 0) {
    fail(`packed manifest still contains workspace: ranges:\n${offending.join("\n")}`);
  }

  const packed = JSON.parse(manifest);
  if (packed.main && !existsSync(resolve(cwd, packed.main))) {
    fail(`packed main "${packed.main}" missing from build output — run pnpm run build first`);
  }

  const exportPaths = collectExportFilePaths(packed.exports);
  for (const rel of exportPaths) {
    const abs = resolve(cwd, rel.replace(/^\.\//, ""));
    if (!existsSync(abs)) {
      fail(`exports map points to missing file "${rel}" — run pnpm run build first`);
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(`publish guard: ${pkgName} packed manifest is clean.`);
