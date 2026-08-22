#!/usr/bin/env node
/**
 * Audit Worker HTTP coverage vs prefix index.
 * Finds: orphan route files, first-segment gaps, suffix-only false prefixes.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const routesDir = join(root, "routes");
const dispatchPath = join(root, "lib", "worker-route-dispatch.js");
const dispatchSrc = readFileSync(dispatchPath, "utf8");

const importByFn = new Map();
for (const line of dispatchSrc.split("\n")) {
  const staticImp = line.match(/import \{ (\w+) \} from "([^"]+)"/);
  if (staticImp) importByFn.set(staticImp[1], staticImp[2]);
  const lazyImp = line.match(
    /const (\w+) = lazyRoute\(\(\) => import\("([^"]+)"\),\s*"\1"\)/,
  );
  if (lazyImp) importByFn.set(lazyImp[1], lazyImp[2]);
}

function extractArray(name) {
  const re = new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\];`);
  const match = dispatchSrc.match(re);
  if (!match) throw new Error(`missing ${name}`);
  return [...match[1].matchAll(/\b(dispatch\w+)\b/g)].map((x) => x[1]);
}

const dispatchers = [
  ...extractArray("WORKER_ROUTE_DISPATCHERS_BEFORE_PRIVACY"),
  "dispatchGdprRoutes",
  "dispatchBillingRoutes",
  ...extractArray("WORKER_ROUTE_DISPATCHERS_AFTER_PRIVACY"),
];

function resolveFromLib(rel) {
  return join(root, "lib", rel);
}

function nestedHttpImports(filePath, seen) {
  if (seen.has(filePath)) return;
  seen.add(filePath);
  let src;
  try {
    src = readFileSync(filePath, "utf8");
  } catch {
    return;
  }
  const nestRe = /from\s+["'](\.\/[^"']+-http\.js)["']/g;
  let pm;
  while ((pm = nestRe.exec(src)) !== null) {
    nestedHttpImports(join(dirname(filePath), pm[1]), seen);
  }
}

function firstSegmentsInFile(src) {
  const segments = new Set();
  function add(raw) {
    const seg = String(raw || "")
      .split("/")
      .filter(Boolean)[0];
    if (seg && !seg.includes("${") && !seg.includes("(")) segments.add(seg);
  }

  const eqRe = /(?:url\.pathname|path)\s*(?:===|!==)\s*["'`](\/[^"'`?]*)/g;
  let pm;
  while ((pm = eqRe.exec(src)) !== null) add(pm[1]);

  const startRe =
    /(?:url\.pathname|path)\s*\.\s*startsWith\s*\(\s*["'`](\/[^"'`?]*)/g;
  while ((pm = startRe.exec(src)) !== null) add(pm[1]);

  const matchRe = /(?:url\.pathname|path)\.match\(\s*\/\^\\\/([a-zA-Z][\w-]*)/g;
  while ((pm = matchRe.exec(src)) !== null) segments.add(pm[1]);

  return segments;
}

const prefixIndex = {};
const indexBlock = dispatchSrc.match(
  /export const WORKER_ROUTE_PREFIX_INDEX = \{([\s\S]*?)\n\};/,
);
if (!indexBlock) throw new Error("missing PREFIX_INDEX");
for (const m of indexBlock[1].matchAll(
  /"([^"]+)":\s*\[([\s\S]*?)\]/g,
)) {
  prefixIndex[m[1]] = [...m[2].matchAll(/\b(dispatch\w+)\b/g)].map((x) => x[1]);
}

const reachableFiles = new Set();
const gaps = [];
const dispatcherSegments = new Map();

for (const fn of dispatchers) {
  const rel = importByFn.get(fn);
  if (!rel) {
    gaps.push({ type: "missing-import", fn });
    continue;
  }
  const seen = new Set();
  nestedHttpImports(resolveFromLib(rel), seen);
  for (const file of seen) reachableFiles.add(file.replaceAll("\\", "/"));

  const segs = new Set();
  for (const file of seen) {
    const src = readFileSync(file, "utf8");
    for (const s of firstSegmentsInFile(src)) segs.add(s);
  }
  dispatcherSegments.set(fn, segs);

  if (fn === "dispatchGdprRoutes" || fn === "dispatchBillingRoutes") continue;

  for (const seg of segs) {
    const bucket = prefixIndex[seg] || [];
    if (!bucket.includes(fn)) {
      gaps.push({ type: "index-gap", fn, segment: seg });
    }
  }
}

const allRouteFiles = readdirSync(routesDir)
  .filter((f) => f.endsWith("-http.js"))
  .map((f) => join(routesDir, f).replaceAll("\\", "/"));

const knownEarly = new Set([
  join(routesDir, "dev-provision-http.js").replaceAll("\\", "/"),
  join(routesDir, "public-http.js").replaceAll("\\", "/"),
]);

const orphans = allRouteFiles.filter(
  (f) => !reachableFiles.has(f) && !knownEarly.has(f),
);

const suffixOnly = [];
const methodRe =
  /(?:url\.pathname|path)\s*\.\s*endsWith\s*\(\s*["'`](\/[^"'`?]*)/g;
for (const [seg, fns] of Object.entries(prefixIndex)) {
  const looksSuffix = ![...Object.values(dispatcherSegments)]
    .some((set) => set.has(seg));
  if (looksSuffix) suffixOnly.push({ segment: seg, fns });
}

console.log(
  JSON.stringify(
    {
      dispatchers: dispatchers.length,
      prefixes: Object.keys(prefixIndex).length,
      routeFiles: allRouteFiles.length,
      reachable: reachableFiles.size,
      orphans: orphans.map((f) => f.split("/routes/").pop() || f.split("\\routes\\").pop()),
      indexGaps: gaps,
      suffixOnlyPrefixes: suffixOnly.map((x) => x.segment).sort(),
    },
    null,
    2,
  ),
);

if (orphans.length || gaps.length) process.exitCode = 1;
