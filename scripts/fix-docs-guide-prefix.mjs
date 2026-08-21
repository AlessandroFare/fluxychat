#!/usr/bin/env node
/**
 * If a /docs/foo href is missing but /docs/guides/foo exists, rewrite it.
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

function pageExists(href) {
  return pages.has(href) || pages.has(`${href}/index`);
}

const hrefRe = /\]\((\/docs\/[^)#\s]+)(#[^)]*)?\)|href=["'](\/docs\/[^"'#]+)(#[^"']*)?["']/g;

let filesChanged = 0;
let hits = 0;

for (const file of walk(DOCS)) {
  if (!/\.mdx?$/.test(file)) continue;
  let text = fs.readFileSync(file, "utf8");
  const original = text;
  text = text.replace(hrefRe, (full, mdPath, mdHash, hrefPath, hrefHash) => {
    const href = (mdPath || hrefPath || "").replace(/\/$/, "");
    if (!href || pageExists(href)) return full;
    const slug = href.replace(/^\/docs\//, "");
    if (slug.includes("/")) return full;
    const guess = `/docs/guides/${slug}`;
    if (!pageExists(guess)) return full;
    hits += 1;
    if (mdPath) return `](${guess}${mdHash || ""})`;
    const quote = full.includes("href='") ? "'" : '"';
    return `href=${quote}${guess}${hrefHash || ""}${quote}`;
  });
  if (text !== original) {
    fs.writeFileSync(file, text);
    filesChanged += 1;
  }
}

console.log(`Prefixed ${hits} hrefs in ${filesChanged} files.`);
