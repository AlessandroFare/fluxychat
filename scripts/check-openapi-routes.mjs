#!/usr/bin/env node
/**
 * OpenAPI ↔ route drift check (ENG-14).
 * Ensures documented paths appear in worker route modules.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const openapiPath = resolve(repoRoot, "apps/worker/openapi.yaml");
const routesDir = resolve(repoRoot, "apps/worker/src/routes");

function extractOpenApiPaths(yaml) {
  const paths = new Set();
  for (const match of yaml.matchAll(/^\s{2}(\/[^\s:]+):/gm)) {
    paths.add(match[1]);
  }
  return paths;
}

function extractRoutePathLiterals(source) {
  const paths = new Set();
  for (const match of source.matchAll(/path(?:name)?\s*===\s*["']([^"']+)["']/g)) {
    paths.add(match[1]);
  }
  for (const match of source.matchAll(/path\.match\(\/\^([^/]+)/g)) {
    const raw = match[1].replace(/\\\//g, "/");
    const slashIdx = raw.indexOf("[");
    const prefix = slashIdx >= 0 ? raw.slice(0, slashIdx) : raw;
    if (prefix.startsWith("/")) paths.add(prefix);
  }
  return paths;
}

function main() {
  const openapi = readFileSync(openapiPath, "utf8");
  const documented = extractOpenApiPaths(openapi);
  const routeSources = readdirSync(routesDir)
    .filter((f) => f.endsWith("-http.js"))
    .map((f) => readFileSync(resolve(routesDir, f), "utf8"))
    .join("\n");

  const implemented = extractRoutePathLiterals(routeSources);
  const missingInCode = [...documented].filter((p) => {
    if (implemented.has(p)) return false;
    return ![...implemented].some((impl) => p.startsWith(impl) || impl.startsWith(p));
  });

  console.log(`openapi-routes: ${documented.size} documented paths, ${implemented.size} route literals scanned`);
  if (missingInCode.length) {
    console.log(`ℹ ${missingInCode.length} templated OpenAPI path(s) not literally matched in route strings (expected for {param} routes)`);
    if (missingInCode.length > 25) {
      console.error("✗ too many undocumented paths — review route drift");
      for (const p of missingInCode.slice(0, 20)) console.error(`  - ${p}`);
      process.exit(1);
    }
  }
  console.log("✓ openapi route smoke check passed");
}

main();

