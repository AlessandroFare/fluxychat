#!/usr/bin/env node
/**
 * MCP remote server.json must match apps/worker package.json mcpName.
 * Does not submit to the official registry.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "apps/worker/server.json"), "utf8"));
const pkg = JSON.parse(readFileSync(join(root, "apps/worker/package.json"), "utf8"));
const sdk = JSON.parse(readFileSync(join(root, "packages/sdk/package.json"), "utf8"));

if (manifest.name !== pkg.mcpName) {
  console.error(`mcpName mismatch: server.json ${manifest.name} vs worker ${pkg.mcpName}`);
  process.exit(1);
}
if (sdk.mcpName !== manifest.name) {
  console.error(`mcpName mismatch: server.json ${manifest.name} vs sdk ${sdk.mcpName}`);
  process.exit(1);
}
if (!Array.isArray(manifest.remotes) || manifest.remotes[0]?.type !== "streamable-http") {
  console.error("server.json remotes[0].type must be streamable-http");
  process.exit(1);
}
if (!String(manifest.remotes[0]?.url || "").includes("/mcp")) {
  console.error("server.json remotes[0].url must include /mcp");
  process.exit(1);
}
console.log(`ok ${manifest.name}`);
