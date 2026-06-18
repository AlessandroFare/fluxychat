#!/usr/bin/env node
/**
 * Pricing consistency cross-check (P0-1 / ENG-03).
 *
 * Verifies that the worker enforcement module
 *   apps/worker/src/lib/plan-tier-limits.ts
 * and the dashboard display module
 *   apps/dashboard/lib/plan-catalog.ts
 * expose the same canonical tier limits. Fails with exit code 1 on drift.
 *
 * Run via:  pnpm run check:pricing        (added to root package.json)
 *       or: node scripts/check-pricing-consistency.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const workerPath = resolve(repoRoot, "apps/worker/src/lib/plan-tier-limits.ts");
const dashboardPath = resolve(repoRoot, "apps/dashboard/lib/plan-catalog.ts");

const EXPECTED_FREE = {
  messageLimitMonthly: 200_000,
  agentInvokeLimitMonthly: 5_000,
  webhookDeliveryLimitMonthly: 50_000,
};

const EXPECTED = {
  starter: {
    messageLimitMonthly: 500_000,
    agentInvokeLimitMonthly: 10_000,
    webhookDeliveryLimitMonthly: 100_000,
  },
  pro: {
    messageLimitMonthly: 5_000_000,
    agentInvokeLimitMonthly: 100_000,
    webhookDeliveryLimitMonthly: 1_000_000,
  },
  team: {
    messageLimitMonthly: 20_000_000,
    agentInvokeLimitMonthly: 200_000,
    webhookDeliveryLimitMonthly: 1_000_000,
  },
  growth: {
    messageLimitMonthly: 100_000_000,
    agentInvokeLimitMonthly: 1_000_000,
    webhookDeliveryLimitMonthly: 5_000_000,
  },
};

function fail(msg) {
  console.error(`\u2717 pricing-consistency: ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`\u2713 pricing-consistency: ${msg}`);
}

// --- 1. Static scan of the worker module (no TS toolchain needed) ---
const workerSrc = readFileSync(workerPath, "utf8");
const workerBody = extractBalancedBlock(
  workerSrc,
  /CANONICAL_TIER_LIMITS[^{]*=\s*Object\.freeze\(\{/,
);
if (workerBody === null) {
  fail(`could not locate CANONICAL_TIER_LIMITS in ${workerPath}`);
}

function extractNumber(haystack, key) {
  // Match `key: <number>` possibly with underscores.
  const re = new RegExp(`${key}\\s*:\\s*([\\d_]+)`);
  const m = haystack.match(re);
  if (!m) return null;
  return Number(m[1].replace(/_/g, ""));
}

function extractTierBody(haystack, tier) {
  // Match `tier: Object.freeze({...})` then balance braces manually.
  const head = haystack.match(
    new RegExp(`${tier}\\s*:\\s*Object\\.freeze\\(\\{`),
  );
  if (!head) return null;
  const start = haystack.indexOf("{", head.index);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < haystack.length; i++) {
    const c = haystack[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return haystack.slice(start + 1, i);
    }
  }
  return null;
}

/**
 * Given a source string and a regex whose match ends just before an opening
 * `{`, return the substring inside the matched `{...}` block, with balanced
 * brace counting (so nested Object.freeze({...}) doesn't trick a non-greedy
 * regex). Returns null if the braces don't balance.
 */
function extractBalancedBlock(src, headerRegex) {
  const header = src.match(headerRegex);
  if (!header) return null;
  const start = src.indexOf("{", header.index);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return src.slice(start + 1, i);
    }
  }
  return null;
}

const workerTiers = {};
for (const tier of Object.keys(EXPECTED)) {
  const tierBody = extractTierBody(workerBody, tier);
  if (!tierBody) fail(`worker CANONICAL_TIER_LIMITS missing tier "${tier}"`);
  const limits = {
    messageLimitMonthly: extractNumber(tierBody, "messageLimitMonthly"),
    agentInvokeLimitMonthly: extractNumber(tierBody, "agentInvokeLimitMonthly"),
    webhookDeliveryLimitMonthly: extractNumber(
      tierBody,
      "webhookDeliveryLimitMonthly",
    ),
  };
  if (
    limits.messageLimitMonthly === null ||
    limits.agentInvokeLimitMonthly === null ||
    limits.webhookDeliveryLimitMonthly === null
  ) {
    fail(
      `worker CANONICAL_TIER_LIMITS.${tier} could not be parsed: ${JSON.stringify(
        limits,
      )}`,
    );
  }
  workerTiers[tier] = limits;
}

// --- 2. Static scan of the dashboard module (TS source) ---
const dashSrc = readFileSync(dashboardPath, "utf8");
const dashBody = extractBalancedBlock(
  dashSrc,
  /CANONICAL_TIER_LIMITS[^{]*=\s*Object\.freeze\(\{/,
);
if (dashBody === null) {
  fail(`could not locate CANONICAL_TIER_LIMITS in ${dashboardPath}`);
}

const dashTiers = {};
for (const tier of Object.keys(EXPECTED)) {
  const tierBody = extractTierBody(dashBody, tier);
  if (!tierBody) fail(`dashboard CANONICAL_TIER_LIMITS missing tier "${tier}"`);
  const limits = {
    messageLimitMonthly: extractNumber(tierBody, "messageLimitMonthly"),
    agentInvokeLimitMonthly: extractNumber(tierBody, "agentInvokeLimitMonthly"),
    webhookDeliveryLimitMonthly: extractNumber(
      tierBody,
      "webhookDeliveryLimitMonthly",
    ),
  };
  if (
    limits.messageLimitMonthly === null ||
    limits.agentInvokeLimitMonthly === null ||
    limits.webhookDeliveryLimitMonthly === null
  ) {
    fail(
      `dashboard CANONICAL_TIER_LIMITS.${tier} could not be parsed: ${JSON.stringify(
        limits,
      )}`,
    );
  }
  dashTiers[tier] = limits;
}

// --- 3. Cross-check worker vs dashboard ---
let drift = false;
for (const tier of Object.keys(EXPECTED)) {
  for (const key of Object.keys(EXPECTED[tier])) {
    if (workerTiers[tier][key] !== dashTiers[tier][key]) {
      fail(
        `tier "${tier}.${key}" drifted: worker=${workerTiers[tier][key]} dashboard=${dashTiers[tier][key]}`,
      );
      drift = true;
    }
  }
}
if (drift) process.exit(1);

// --- 4. Sanity-check against the audited baseline (catches a "both wrong" edit) ---
for (const tier of Object.keys(EXPECTED)) {
  for (const key of Object.keys(EXPECTED[tier])) {
    if (workerTiers[tier][key] !== EXPECTED[tier][key]) {
      fail(
        `tier "${tier}.${key}" drifted from audited baseline: got=${workerTiers[tier][key]} expected=${EXPECTED[tier][key]}`,
      );
    }
  }
}

function parseFreeTierLimits(src) {
  const body = extractBalancedBlock(src, /FREE_TIER_LIMITS[^=]*=\s*Object\.freeze\(\{/);
  if (!body) return null;
  return {
    messageLimitMonthly: extractNumber(body, "messageLimitMonthly"),
    agentInvokeLimitMonthly: extractNumber(body, "agentInvokeLimitMonthly"),
    webhookDeliveryLimitMonthly: extractNumber(body, "webhookDeliveryLimitMonthly"),
  };
}

const workerFree = parseFreeTierLimits(workerSrc);
const dashFree = parseFreeTierLimits(dashSrc);
for (const key of Object.keys(EXPECTED_FREE)) {
  if (workerFree?.[key] !== EXPECTED_FREE[key]) {
    fail(`worker FREE_TIER_LIMITS.${key} drifted: got=${workerFree?.[key]} expected=${EXPECTED_FREE[key]}`);
  }
  if (dashFree?.[key] !== EXPECTED_FREE[key]) {
    fail(`dashboard FREE_TIER_LIMITS.${key} drifted: got=${dashFree?.[key]} expected=${EXPECTED_FREE[key]}`);
  }
  if (workerFree?.[key] !== dashFree?.[key]) {
    fail(`free tier ${key} drifted: worker=${workerFree?.[key]} dashboard=${dashFree?.[key]}`);
  }
}

ok(
  `worker and dashboard agree on canonical tier limits for: ${Object.keys(
    EXPECTED,
  ).join(", ")} and free tier defaults`,
);
