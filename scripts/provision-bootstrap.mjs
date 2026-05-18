#!/usr/bin/env node
/**
 * Bootstrap the hosted Fluxychat platform project on a Worker deployment.
 *
 * Usage:
 *   PLATFORM_BOOTSTRAP_SECRET=... FLUXY_WORKER_URL=https://api.example.com node scripts/provision-bootstrap.mjs
 *   pnpm provision:bootstrap
 *
 * Secrets are written to scripts/.provision-secrets.env (gitignored, mode 600 on Unix).
 * They are not printed to stdout (avoids CI logs and terminal history leaks).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SECRETS_PATH = path.join(__dirname, ".provision-secrets.env");

function stripTrailingSlashes(u) {
  let s = u;
  while (s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

const workerUrl = stripTrailingSlashes(
  process.env.FLUXY_WORKER_URL ||
    process.env.NEXT_PUBLIC_FLUXYCHAT_CLOUD_URL ||
    process.env.NEXT_PUBLIC_FLUXYCHAT_WORKER_URL ||
    "http://127.0.0.1:8787",
);

const bootstrapSecret = process.env.PLATFORM_BOOTSTRAP_SECRET?.trim();
const projectName = process.env.PLATFORM_PROJECT_NAME?.trim() || "Fluxychat Platform";
const existingKey = process.env.FLUXY_CONSOLE_API_KEY?.trim();

function writeSecretsFile(lines) {
  const body = `${lines.join("\n")}\n`;
  fs.writeFileSync(SECRETS_PATH, body, { encoding: "utf8", mode: 0o600 });
  try {
    fs.chmodSync(SECRETS_PATH, 0o600);
  } catch {
    /* Windows may ignore chmod */
  }
}

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
  console.log("\n✓ FLUXY_CONSOLE_API_KEY is valid (key value not logged)");
  console.log(`  projectId (tid): ${json.claims?.tid}`);
  console.log("\nAdd to apps/dashboard/.env.local (copy from your secure store; key is in FLUXY_CONSOLE_API_KEY env):");
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
  const consoleKey = setup?.FLUXY_CONSOLE_API_KEY || project.apiKey;
  const consoleProjectId = setup?.FLUXY_CONSOLE_PROJECT_ID || project.id;
  const platformProjectId = setup?.FLUXY_PLATFORM_PROJECT_ID || project.id;

  console.log("\n✓ Platform project created on", workerUrl);
  console.log(`  name: ${project.name}`);
  console.log(`  id:   ${project.id}`);
  console.log("  apiKey: (written to secrets file only, not logged)\n");

  writeSecretsFile([
    "--- Worker secrets / vars ---",
    "HOSTED_MULTI_TENANT=true",
    `FLUXY_PLATFORM_PROJECT_ID=${platformProjectId}`,
    "PLATFORM_BOOTSTRAP_SECRET=(keep secret, disable ALLOW_PLATFORM_BOOTSTRAP after setup)",
    "",
    "--- apps/dashboard/.env.local ---",
    `NEXT_PUBLIC_FLUXYCHAT_CLOUD_URL=${workerUrl}`,
    `FLUXY_CONSOLE_API_KEY=${consoleKey}`,
    `FLUXY_CONSOLE_PROJECT_ID=${consoleProjectId}`,
    `FLUXY_PLATFORM_PROJECT_ID=${platformProjectId}`,
    "",
    "--- Clerk webhook (optional, eager provision) ---",
    `POST ${process.env.DASHBOARD_PUBLIC_URL || "https://your-dashboard"}/api/webhooks/clerk`,
    "Event: user.created",
  ]);

  console.log(`Secrets written to: ${SECRETS_PATH}`);
  console.log("Copy the FLUXY_* lines from that file into apps/dashboard/.env.local (file is gitignored).");
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
