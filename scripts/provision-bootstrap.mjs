#!/usr/bin/env node
/**
 * Bootstrap the hosted Fluxychat platform project on a Worker deployment.
 *
 * Usage:
 *   PLATFORM_BOOTSTRAP_SECRET=... FLUXY_WORKER_URL=https://api.example.com node scripts/provision-bootstrap.mjs
 *   pnpm provision:bootstrap
 *
 * Prints FLUXY_CONSOLE_API_KEY + FLUXY_PLATFORM_PROJECT_ID for dashboard .env.local
 */

const workerUrl = (
  process.env.FLUXY_WORKER_URL ||
  process.env.NEXT_PUBLIC_FLUXYCHAT_CLOUD_URL ||
  process.env.NEXT_PUBLIC_FLUXYCHAT_WORKER_URL ||
  "http://127.0.0.1:8787"
).replace(/\/$/, "");

const bootstrapSecret = process.env.PLATFORM_BOOTSTRAP_SECRET?.trim();
const projectName = process.env.PLATFORM_PROJECT_NAME?.trim() || "Fluxychat Platform";
const existingKey = process.env.FLUXY_CONSOLE_API_KEY?.trim();

async function verifyExistingKey() {
  if (!existingKey) return false;
  const res = await fetch(`${workerUrl}/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Fluxy-Api-Key": existingKey,
    },
    body: JSON.stringify({
      userId: "bootstrap_verify",
      roles: ["admin"],
      ttlSeconds: 120,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.error("Existing FLUXY_CONSOLE_API_KEY failed:", body.error || res.status);
    return false;
  }
  const json = await res.json();
  console.log("\n✓ FLUXY_CONSOLE_API_KEY is valid");
  console.log(`  projectId (tid): ${json.claims?.tid}`);
  console.log("\nAdd to apps/dashboard/.env.local:");
  console.log(`FLUXY_CONSOLE_API_KEY=${existingKey}`);
  console.log(`FLUXY_CONSOLE_PROJECT_ID=${json.claims?.tid}`);
  console.log(`FLUXY_PLATFORM_PROJECT_ID=${json.claims?.tid}`);
  console.log(`NEXT_PUBLIC_FLUXYCHAT_CLOUD_URL=${workerUrl}`);
  console.log("HOSTED_MULTI_TENANT=true  # set on Worker wrangler secrets");
  return true;
}

async function runBootstrap() {
  if (!bootstrapSecret) {
    console.error(
      "Missing PLATFORM_BOOTSTRAP_SECRET (set on Worker as PLATFORM_BOOTSTRAP_SECRET, min 32 chars).",
    );
    process.exit(1);
  }

  const res = await fetch(`${workerUrl}/platform/bootstrap`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Fluxy-Bootstrap-Secret": bootstrapSecret,
    },
    body: JSON.stringify({ name: projectName }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Bootstrap failed:", json.error || json.message || res.status);
    if (json.error === "bootstrap_disabled") {
      console.error(
        "Tip: set ALLOW_PLATFORM_BOOTSTRAP=true on the Worker to re-run, or use FLUXY_CONSOLE_API_KEY=... pnpm provision:bootstrap",
      );
    }
    process.exit(1);
  }

  const { project, setup } = json;
  console.log("\n✓ Platform project created on", workerUrl);
  console.log(`  name: ${project.name}`);
  console.log(`  id:   ${project.id}`);
  console.log(`  key:  ${project.apiKey}\n`);
  console.log("--- Worker secrets / vars ---");
  console.log(`HOSTED_MULTI_TENANT=true`);
  console.log(`FLUXY_PLATFORM_PROJECT_ID=${setup?.FLUXY_PLATFORM_PROJECT_ID || project.id}`);
  console.log(`PLATFORM_BOOTSTRAP_SECRET=(keep secret, disable ALLOW_PLATFORM_BOOTSTRAP after setup)`);
  console.log("\n--- apps/dashboard/.env.local ---");
  console.log(`NEXT_PUBLIC_FLUXYCHAT_CLOUD_URL=${workerUrl}`);
  console.log(`FLUXY_CONSOLE_API_KEY=${setup?.FLUXY_CONSOLE_API_KEY || project.apiKey}`);
  console.log(`FLUXY_CONSOLE_PROJECT_ID=${setup?.FLUXY_CONSOLE_PROJECT_ID || project.id}`);
  console.log(`FLUXY_PLATFORM_PROJECT_ID=${setup?.FLUXY_PLATFORM_PROJECT_ID || project.id}`);
  console.log("\n--- Clerk webhook (optional, eager provision) ---");
  console.log(`POST ${process.env.DASHBOARD_PUBLIC_URL || "https://your-dashboard"}/api/webhooks/clerk`);
  console.log("Event: user.created");
}

async function main() {
  console.log("Fluxychat platform bootstrap");
  console.log("Worker:", workerUrl);

  if (existingKey && (process.argv.includes("--verify") || !bootstrapSecret)) {
    const ok = await verifyExistingKey();
    process.exit(ok ? 0 : 1);
  }

  await runBootstrap();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
