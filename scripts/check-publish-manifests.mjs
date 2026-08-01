#!/usr/bin/env node
/** CI helper — verify publish manifests for all public packages. */
import { execFileSync } from "node:child_process";
import { join } from "node:path";

import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const packages = [
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

for (const rel of packages) {
  const cwd = join(root, rel);
  console.log(`\n→ checking ${rel}`);
  execFileSync("node", ["../../scripts/verify-publish-manifest.mjs", "--dry-run"], {
    cwd,
    stdio: "inherit",
    env: { ...process.env, FLUXY_PUBLISH_GUARD_DRY: "1" },
  });
}

console.log("\nAll publish manifests OK.");
