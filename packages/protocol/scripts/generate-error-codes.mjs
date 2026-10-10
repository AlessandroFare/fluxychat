#!/usr/bin/env node
/**
 * Writes packages/protocol/src/error-codes.ts from errors/catalog.json.
 * Run: node scripts/generate-error-codes.mjs
 * Check: node scripts/generate-error-codes.mjs --check
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = resolve(root, "errors/catalog.json");
const outPath = resolve(root, "src/error-codes.ts");

const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
const errors = catalog.errors;
const hrefBase = String(catalog.hrefBase).replace(/\/$/, "");

const ids = errors.map((e) => e.identifier);
const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dup.length) throw new Error(`duplicate identifier: ${dup.join(", ")}`);
const codes = errors.map((e) => e.code);
const dupCode = codes.filter((c, i) => codes.indexOf(c) !== i);
if (dupCode.length) throw new Error(`duplicate code: ${dupCode.join(", ")}`);

const constEntries = errors
  .map((e) => `  ${JSON.stringify(e.identifier)}: ${e.code},`)
  .join("\n");

const recordEntries = errors
  .map((e) => {
    const href = `${hrefBase}/${e.identifier}`;
    return `  {
    code: ${e.code},
    identifier: ${JSON.stringify(e.identifier)},
    title: ${JSON.stringify(e.title)},
    httpStatus: ${e.httpStatus},
    terminal: ${e.terminal},
    href: ${JSON.stringify(href)},
  },`;
  })
  .join("\n");

const generated = `/* Generated from errors/catalog.json — do not edit by hand. */
export const FLUXY_ERROR_HREF_BASE = ${JSON.stringify(hrefBase)} as const;

export const FLUXY_ERROR_CODES = {
${constEntries}
} as const;

export type FluxyErrorIdentifier = keyof typeof FLUXY_ERROR_CODES;

export interface FluxyErrorCatalogEntry {
  code: number;
  identifier: FluxyErrorIdentifier;
  title: string;
  httpStatus: number;
  terminal: boolean;
  href: string;
}

export const FLUXY_ERROR_CATALOG: readonly FluxyErrorCatalogEntry[] = [
${recordEntries}
];

const byCode = new Map<number, FluxyErrorCatalogEntry>(
  FLUXY_ERROR_CATALOG.map((entry) => [entry.code, entry]),
);
const byIdentifier = new Map<string, FluxyErrorCatalogEntry>(
  FLUXY_ERROR_CATALOG.map((entry) => [entry.identifier, entry]),
);

export function fluxyErrorByCode(code: number): FluxyErrorCatalogEntry | undefined {
  return byCode.get(code);
}

export function fluxyErrorByIdentifier(
  identifier: string,
): FluxyErrorCatalogEntry | undefined {
  return byIdentifier.get(identifier);
}
`;

if (process.argv.includes("--check")) {
  const current = readFileSync(outPath, "utf8");
  if (current !== generated) {
    console.error("error-codes.ts is stale. Run: pnpm --filter @fluxy-chat/protocol generate:errors");
    process.exit(1);
  }
  process.exit(0);
}

writeFileSync(outPath, generated);
console.log(`wrote ${outPath}`);
