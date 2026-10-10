#!/usr/bin/env node
/**
 * Fails if public copy drifts from docs/product-facts.json.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const facts = JSON.parse(readFileSync(resolve(root, "docs/product-facts.json"), "utf8"));
const errors = [];

function read(rel) {
  return readFileSync(resolve(root, rel), "utf8");
}

const ts = read("apps/dashboard/lib/product-facts.ts");
for (const [label, value] of [
  ["supportEmail", facts.supportEmail],
  ["founderEmail", facts.founderEmail],
  ["githubRepo", facts.githubRepo],
  ["betaBanner", facts.betaBanner],
]) {
  if (!ts.includes(value)) errors.push(`product-facts.ts missing ${label}: ${value}`);
}

const publicFiles = [
  "README.md",
  "SECURITY.md",
  "apps/dashboard/lib/plan-catalog.ts",
  "apps/dashboard/lib/marketing-landing.ts",
  "apps/dashboard/app/landing/landing-footer.tsx",
  "apps/dashboard/app/pricing/page.tsx",
  "apps/dashboard/app/privacy/page.tsx",
  "apps/dashboard/app/terms/page.tsx",
  "apps/dashboard/app/dpa/page.tsx",
  "apps/dashboard/app/trust/page.tsx",
  "apps/dashboard/app/report/page.tsx",
  "apps/worker/src/lib/dsa-notice.js",
];

for (const rel of publicFiles) {
  const text = read(rel);
  if (text.includes("fluxychat@outlook.com")) {
    errors.push(`${rel} still has fluxychat@outlook.com`);
  }
}

const readme = read("README.md");
if (!readme.includes(facts.supportEmail) && !readme.includes(facts.founderEmail)) {
  errors.push("README.md has neither support nor founder @fluxychat.com");
}
if (readme.includes("QUOTA_MESSAGES_PER_MONTH` (50000)")) {
  errors.push("README.md still documents 50000 monthly messages; worker default is 200000");
}
if (readme.includes("github.com/fluxychat/fluxychat")) {
  errors.push("README.md clone URL must be AlessandroFare/fluxychat");
}
if (!readme.includes(String(facts.freeQuota.messagesPerMonth)) && !readme.includes("200k") && !readme.includes("200,000")) {
  errors.push("README.md should mention the 200000 free-tier message quota");
}
if (readme.includes("## Publish to npm")) {
  errors.push("README.md still has Publish to npm; that belongs in RELEASING.md");
}

if (errors.length) {
  console.error(errors.map((e) => `- ${e}`).join("\n"));
  process.exit(1);
}
console.log("product-facts ok");
