#!/usr/bin/env node
/**
 * Find /docs/... links in Fumadocs content that do not map to an mdx/json page.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = path.join(ROOT, "apps/docs/content/docs");

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(mdx?|json)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const pages = new Set();
for (const file of walk(DOCS)) {
  const rel = path.relative(DOCS, file).replace(/\\/g, "/");
  if (rel.endsWith("/meta.json") || rel === "meta.json") continue;
  const noExt = rel.replace(/\.(mdx|md)$/, "");
  const slug = noExt.replace(/\/index$/, "");
  pages.add(`/docs/${slug}`);
  pages.add(`/docs/${noExt}`);
}

const hrefRe = /\]\((\/docs\/[^)#\s]+)(?:#[^)]*)?\)|href=["'](\/docs\/[^"'#]+)(?:#[^"']*)?["']/g;
const missing = [];

for (const file of walk(DOCS)) {
  if (!/\.mdx?$/.test(file)) continue;
  const text = fs.readFileSync(file, "utf8");
  const rel = path.relative(DOCS, file).replace(/\\/g, "/");
  let match;
  hrefRe.lastIndex = 0;
  while ((match = hrefRe.exec(text))) {
    const href = (match[1] || match[2] || "").replace(/\/$/, "");
    if (!href || href.includes("${")) continue;
    if (pages.has(href) || pages.has(`${href}/index`)) continue;
    missing.push(`${rel} → ${href}`);
  }
}

missing.sort();
if (missing.length === 0) {
  console.log("No broken /docs/ links found.");
  process.exit(0);
}

console.log(`Broken /docs/ links (${missing.length}):\n`);
for (const line of missing) console.log(`  ${line}`);
process.exit(1);
