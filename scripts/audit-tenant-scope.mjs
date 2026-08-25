#!/usr/bin/env node
/**
 * Tenant-scope audit (P1 ENG-07).
 *
 * Flags HTTP route modules that accept projectId from the request (query/path/body)
 * without an obvious JWT or admin tenant-scope guard in the same file.
 *
 * Run:  pnpm run check:tenant-scope
 *       node scripts/audit-tenant-scope.mjs [--strict]
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const routesDir = resolve(__dirname, "../apps/worker/src/routes");
const baselinePath = resolve(__dirname, "audit-tenant-scope-baseline.json");

const EXTERNAL_PROJECT_ID_PATTERNS = [
  /searchParams\.get\(["']projectId["']\)/,
  /searchParams\.get\(["']project_id["']\)/,
  /\btargetProjectId\b/,
  /pathname\.split\([^)]+\)\[[^\]]+\].*project/i,
  /body\.projectId\b/,
  /body\?\.projectId\b/,
  /params\.projectId\b/,
];

const GUARD_PATTERNS = [
  /\bverifyJwtAndGetContext\b/,
  /\brequireAdminJwt\b/,
  /\brequireApiProjectAdmin\b/,
  /\btenantScopeForbidden\b/,
  /\bverifyAdminJwt\b/,
  /\bverifyScimToken\b/,
  /\bverifyWebhookSignature\b/,
];

/** Routes intentionally public or pre-authenticated at worker boundary. */
const ALLOWLIST = new Set([
  "public-http.js",
  "embed-http.js",
  "gdpr-http.js",
  "billing-stripe-http.js",
  "mcp-http.js",
]);

function loadBaseline() {
  try {
    const raw = readFileSync(baselinePath, "utf8");
    return new Set(JSON.parse(raw).allowedFiles || []);
  } catch {
    return null;
  }
}

function auditRouteFile(name, source) {
  if (ALLOWLIST.has(name)) return null;
  const hasExternal = EXTERNAL_PROJECT_ID_PATTERNS.some((re) => re.test(source));
  if (!hasExternal) return null;
  const hasGuard = GUARD_PATTERNS.some((re) => re.test(source));
  if (hasGuard) return null;
  return name;
}

function main() {
  const strict = process.argv.includes("--strict");
  const files = readdirSync(routesDir).filter((f) => f.endsWith("-http.js"));
  const flagged = [];

  for (const name of files.sort()) {
    const source = readFileSync(resolve(routesDir, name), "utf8");
    const hit = auditRouteFile(name, source);
    if (hit) flagged.push(hit);
  }

  console.log(`tenant-scope audit: ${files.length} route files scanned`);
  if (!flagged.length) {
    console.log("✓ no high-risk tenant-scope gaps detected");
    return;
  }

  console.log(`\n⚠ ${flagged.length} route file(s) accept external projectId without in-file guards:\n`);
  for (const f of flagged) console.log(`  - ${f}`);

  const baseline = loadBaseline();
  if (baseline) {
    const newViolations = flagged.filter((f) => !baseline.has(f));
    if (newViolations.length) {
      console.error(`\n✗ ${newViolations.length} new violation(s) not in baseline:`);
      for (const f of newViolations) console.error(`  - ${f}`);
      process.exit(1);
    }
    console.log(`\n✓ all flagged files are in baseline (${baseline.size} known)`);
    return;
  }

  if (strict) {
    console.error("\n✗ strict mode: fix guards or add baseline before merging");
    process.exit(1);
  }

  console.log("\nℹ run with --strict to fail, or add scripts/audit-tenant-scope-baseline.json");
}

main();
