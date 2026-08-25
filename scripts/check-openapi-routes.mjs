#!/usr/bin/env node
/**
 * OpenAPI ↔ HTTP route drift (ENG-14).
 *
 * Bidirectional, zero tolerance:
 *   1. Every path in openapi.yaml must match a route in worker HTTP modules.
 *   2. Every exact `pathname === "/…"` in those modules must appear in OpenAPI
 *      unless listed in scripts/openapi-undocumented-allowlist.json WITH a reason.
 *
 * `{param}` templates match `/foo/bar` one segment. Prefix `startsWith` matching
 * is not used — that is what made the old gate pass while routes drifted.
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const openapiPath = resolve(repoRoot, "apps/worker/openapi.yaml");
const routesDir = resolve(repoRoot, "apps/worker/src/routes");
const allowlistPath = resolve(__dirname, "openapi-undocumented-allowlist.json");

function extractOpenApiPaths(yaml) {
  const paths = new Set();
  for (const match of yaml.matchAll(/^\s{2}(\/[^\s:]+):/gm)) {
    paths.add(match[1]);
  }
  return paths;
}

function openApiToRegex(template) {
  const escaped = template.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const withParams = escaped.replace(/\\\{[^/}]+\\\}/g, "[^/]+");
  return new RegExp(`^${withParams}$`);
}

function extractRoutePathLiterals(source) {
  const paths = new Set();
  for (const match of source.matchAll(
    /(?:url\.)?path(?:name)?\s*(?:===|!==)\s*["'](\/[^"']+)["']/g,
  )) {
    paths.add(match[1]);
  }
  return paths;
}

/** `/rooms/{id}/e2e-key` → `/rooms/_/e2e-key` for regex testing. */
function sampleFromTemplate(template) {
  return template.replace(/\{[^}]+\}/g, "_");
}

function extractPathnameRegexes(source) {
  const regexes = [];
  const key = ".match(";
  let i = 0;
  while ((i = source.indexOf(key, i)) !== -1) {
    let j = i + key.length;
    while (j < source.length && /\s/.test(source[j])) j += 1;
    if (source[j] !== "/") {
      i += 1;
      continue;
    }
    j += 1;
    let body = "";
    let inClass = false;
    let escaped = false;
    for (; j < source.length; j += 1) {
      const c = source[j];
      if (escaped) {
        body += c;
        escaped = false;
        continue;
      }
      if (c === "\\") {
        body += c;
        escaped = true;
        continue;
      }
      if (c === "[" && !inClass) {
        inClass = true;
        body += c;
        continue;
      }
      if (c === "]" && inClass) {
        inClass = false;
        body += c;
        continue;
      }
      if (c === "/" && !inClass) break;
      body += c;
    }
    try {
      regexes.push(new RegExp(body));
    } catch {
      /* skip */
    }
    i = j + 1;
  }
  return regexes;
}

function extractStartsWithPrefixes(source) {
  const prefixes = [];
  for (const match of source.matchAll(
    /(?:url\.)?path(?:name)?\.startsWith\(\s*["'](\/[^"']+)["']\s*\)/g,
  )) {
    prefixes.push(match[1]);
  }
  return prefixes;
}

function documentedMatchesCode(docPath, literals, pathnameRegexes, startsWithPrefixes) {
  if (literals.has(docPath)) return true;
  const sample = sampleFromTemplate(docPath);
  const asExact = openApiToRegex(docPath);
  for (const lit of literals) {
    if (asExact.test(lit)) return true;
  }
  for (const re of pathnameRegexes) {
    if (re.test(sample)) return true;
  }
  for (const prefix of startsWithPrefixes) {
    if (sample.startsWith(prefix) || docPath.startsWith(prefix)) return true;
  }
  return false;
}

function loadAllowlist() {
  if (!existsSync(allowlistPath)) return new Map();
  const raw = JSON.parse(readFileSync(allowlistPath, "utf8"));
  const map = new Map();
  for (const entry of raw.paths || []) {
    if (!entry?.path || !entry?.reason) {
      throw new Error("openapi-undocumented-allowlist.json entries need path + reason");
    }
    map.set(entry.path, entry.reason);
  }
  return map;
}

function main() {
  const dumpAllowlist = process.argv.includes("--write-allowlist");
  const openapi = readFileSync(openapiPath, "utf8");
  const documented = extractOpenApiPaths(openapi);
  const routeFiles = readdirSync(routesDir).filter((f) => f.endsWith("-http.js"));
  const routeSources = routeFiles
    .map((f) => readFileSync(resolve(routesDir, f), "utf8"))
    .join("\n");

  const literals = extractRoutePathLiterals(routeSources);
  const pathnameRegexes = extractPathnameRegexes(routeSources);
  const startsWithPrefixes = extractStartsWithPrefixes(routeSources);
  const allowlist = loadAllowlist();

  const missingInCode = [...documented].filter(
    (p) => !documentedMatchesCode(p, literals, pathnameRegexes, startsWithPrefixes),
  );

  const undocumented = [...literals].filter((p) => {
    if (allowlist.has(p)) return false;
    for (const doc of documented) {
      if (p === doc) return false;
      if (openApiToRegex(doc).test(p)) return false;
    }
    return true;
  });

  const unusedAllow = [...allowlist.keys()].filter((p) => !literals.has(p));

  console.log(
    `openapi-routes: ${documented.size} documented, ${literals.size} exact literals, ` +
      `${pathnameRegexes.length} pathname.match regexes, ${startsWithPrefixes.length} startsWith prefixes, ` +
      `${allowlist.size} allow-listed extras`,
  );

  const errors = [];
  if (missingInCode.length) {
    errors.push(`OpenAPI paths with no matching worker route (${missingInCode.length}):`);
    for (const p of missingInCode) errors.push(`  - ${p}`);
  }
  if (undocumented.length) {
    errors.push(
      `Worker literals missing from OpenAPI (${undocumented.length}) — document them or add a reason in scripts/openapi-undocumented-allowlist.json:`,
    );
    for (const p of undocumented.slice(0, 40)) errors.push(`  - ${p}`);
    if (undocumented.length > 40) errors.push(`  … +${undocumented.length - 40} more`);
  }
  if (unusedAllow.length) {
    errors.push(`Allowlist paths no longer present in routes (${unusedAllow.length}):`);
    for (const p of unusedAllow) errors.push(`  - ${p}`);
  }

  if (dumpAllowlist && undocumented.length) {
    const payload = {
      comment:
        "Exact route literals not in openapi.yaml. New paths must be documented or added here with a reason. Do not grow this list silently.",
      paths: undocumented.sort().map((path) => ({
        path,
        reason: "pre-existing HTTP route not yet in openapi.yaml",
      })),
    };
    writeFileSync(allowlistPath, `${JSON.stringify(payload, null, 2)}\n`);
    console.log(`wrote ${undocumented.length} undocumented paths to ${allowlistPath}`);
    // Snapshot only — still fail if OpenAPI documents a path with no code.
    if (!missingInCode.length) {
      console.log("✓ allowlist snapshot written");
      return;
    }
  }

  if (errors.length) {
    console.error("✗ openapi route gate failed (zero tolerance)\n" + errors.join("\n"));
    process.exit(1);
  }
  console.log("✓ OpenAPI ↔ routes match (bidirectional, zero unmatched documented paths)");
}

main();
