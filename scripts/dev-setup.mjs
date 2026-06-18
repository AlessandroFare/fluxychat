#!/usr/bin/env node
/**
 * Copy local dev env templates (ENG-20). Never overwrites existing files.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const copies = [
  {
    from: "apps/worker/.dev.vars.example",
    to: "apps/worker/.dev.vars",
    hint: "Edit ALLOWED_ORIGINS and optional Stripe / hosted SaaS vars before `pnpm --filter @fluxychat/worker dev`.",
  },
  {
    from: "apps/dashboard/.env.example",
    to: "apps/dashboard/.env.local",
    hint: "Set NEXT_PUBLIC_FLUXYCHAT_WORKER_URL (or CLOUD_URL) and Clerk keys if using hosted sign-in.",
  },
];

let created = 0;
let skipped = 0;

for (const { from, to, hint } of copies) {
  const src = path.join(root, from);
  const dest = path.join(root, to);
  if (!fs.existsSync(src)) {
    console.warn(`skip: missing template ${from}`);
    continue;
  }
  if (fs.existsSync(dest)) {
    console.log(`skip: ${to} already exists`);
    skipped += 1;
    continue;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`created: ${to}`);
  console.log(`  → ${hint}`);
  created += 1;
}

console.log(`\ndev-setup: ${created} created, ${skipped} skipped.`);
if (created > 0) {
  console.log("Do not commit .dev.vars or .env.local — they may contain secrets.");
}
console.log("Staging/production: docs/operations/environment-setup.md — run `pnpm run check:env` for a checklist.");

