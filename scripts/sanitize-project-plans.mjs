#!/usr/bin/env node
/**
 * Re-align D1 project_plans to canonical tier limits (clears manual overrides).
 *
 * Usage:
 *   PLATFORM_BOOTSTRAP_SECRET=... FLUXY_WORKER_URL=https://api.example.com node scripts/sanitize-project-plans.mjs
 *   pnpm sanitize:plans              # dry-run (default)
 *   pnpm sanitize:plans -- --apply   # write changes
 *
 * Options (env or flags):
 *   --apply          Apply updates (default: dry-run)
 *   --demote-unpaid  Demote tiers without active Stripe to free (default: true)
 *   --no-demote      Keep plan_name tier even without Stripe (operator manual grants)
 */

const workerUrl = (
  process.env.FLUXY_WORKER_URL ||
  process.env.NEXT_PUBLIC_FLUXYCHAT_CLOUD_URL ||
  process.env.NEXT_PUBLIC_FLUXYCHAT_WORKER_URL ||
  "http://127.0.0.1:8787"
).replace(/\/$/, "");

const bootstrapSecret = process.env.PLATFORM_BOOTSTRAP_SECRET?.trim();
const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const demoteUnpaid = !argv.includes("--no-demote");
const dryRun = !apply;

async function main() {
  if (!bootstrapSecret) {
    console.error("Missing PLATFORM_BOOTSTRAP_SECRET (same secret as platform bootstrap).");
    process.exit(1);
  }

  const params = new URLSearchParams();
  if (dryRun) params.set("dryRun", "true");
  if (!demoteUnpaid) params.set("demoteUnpaid", "false");
  const limit = process.env.SANITIZE_PLANS_LIMIT?.trim();
  if (limit) params.set("limit", limit);

  const url = `${workerUrl}/platform/sanitize-plans?${params.toString()}`;
  console.log(apply ? "Applying plan sanitization" : "Dry-run plan sanitization");
  console.log("Worker:", workerUrl);
  console.log("Demote unpaid tiers to free:", demoteUnpaid);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Fluxy-Bootstrap-Secret": bootstrapSecret,
    },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Sanitize failed:", json.error || json.message || res.status);
    process.exit(1);
  }

  console.log(`\nScanned: ${json.scanned}  Would change / changed: ${json.updated}`);
  if (Array.isArray(json.changes) && json.changes.length > 0) {
    console.log("\nChanges:");
    for (const c of json.changes.slice(0, 50)) {
      console.log(`  ${c.projectId}`);
      console.log(
        `    plan ${c.before.planName} → ${c.after.planName} | msgs ${c.before.messageLimitMonthly} → ${c.after.messageLimitMonthly}`,
      );
    }
    if (json.changes.length > 50) {
      console.log(`  … and ${json.changes.length - 50} more`);
    }
  }

  if (dryRun && json.updated > 0) {
    console.log("\nRe-run with --apply to persist fixes.");
  } else if (apply && json.updated > 0) {
    console.log("\n✓ Plans sanitized.");
  } else {
    console.log("\n✓ No rows needed updates.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
