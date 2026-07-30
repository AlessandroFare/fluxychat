#!/usr/bin/env node
// prepublishOnly guard: refuses to publish if the manifest that would actually be
// published still contains a "workspace:" protocol range.
//
// `pnpm publish` rewrites "workspace:" ranges to real semver ranges when it packs the
// tarball, but `npm publish` does not understand the protocol at all and ships it
// through literally. That's how every previously published version of @portalsdk/core
// and @portalsdk/react ended up uninstallable outside this workspace
// (ERR_PNPM_WORKSPACE_PKG_NOT_FOUND for consumers). See ../RELEASING.md.
//
// This runs two checks:
//   1. Refuse outright if the current lifecycle invocation isn't pnpm (detected via
//      npm_config_user_agent) — npm's own packing never rewrites workspace: ranges,
//      so letting it proceed past this hook would reproduce the exact bug we're
//      fixing regardless of what check #2 below finds.
//   2. Defense in depth: actually pack the tarball with `pnpm pack` and confirm the
//      packed manifest is clean, in case any dependency range was missed by pnpm's
//      rewrite (e.g. a future dependency field pnpm doesn't rewrite).
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const pkgName = process.env.npm_package_name ?? "this package";

function fail(reason) {
  console.error(`\npublish guard failed for ${pkgName}: ${reason}\nSee RELEASING.md — releases use \`pnpm publish\` only.\n`);
  process.exit(1);
}

const userAgent = process.env.npm_config_user_agent ?? "";
if (!userAgent.startsWith("pnpm/")) {
  fail(
    `this must run via "pnpm publish", not npm (detected user agent: "${userAgent || "unknown"}"). ` +
      `npm does not rewrite "workspace:" dependency ranges to real semver ranges at publish time.`,
  );
}

const dir = mkdtempSync(join(tmpdir(), "publish-guard-"));
try {
  execFileSync("pnpm", ["pack", "--pack-destination", dir], { stdio: "pipe" });
  const tarball = readdirSync(dir).find((f) => f.endsWith(".tgz"));
  const manifest = execFileSync("tar", ["xOzf", join(dir, tarball), "package/package.json"]).toString();
  const offending = manifest.split("\n").filter((line) => line.includes('"workspace:'));
  if (offending.length > 0) {
    fail(`the packed manifest still contains "workspace:" ranges:\n${offending.join("\n")}`);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(`publish guard: ${pkgName} packed manifest is clean, no "workspace:" ranges.`);
