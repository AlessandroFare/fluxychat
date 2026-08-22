#!/usr/bin/env node
/**
 * Regenerates lib/worker-route-dispatch.js with prefix indexing + lazy labs.
 * Order is preserved from the current dispatch file.
 * Composites (e.g. messages-agents) scrape nested route modules.
 *
 * Hot-path modules stay as static imports (cold-start friendly for GA).
 * Labs / verticals load via dynamic import() on first use.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const dispatchPath = join(root, "lib", "worker-route-dispatch.js");
const existing = readFileSync(dispatchPath, "utf8");

const importByFn = new Map();
for (const line of existing.split("\n")) {
  const staticImp = line.match(/import \{ (\w+) \} from "([^"]+)"/);
  if (staticImp) importByFn.set(staticImp[1], staticImp[2]);
  const lazyImp = line.match(
    /const (\w+) = lazyRoute\(\(\) => import\("([^"]+)"\),\s*"\1"\)/,
  );
  if (lazyImp) importByFn.set(lazyImp[1], lazyImp[2]);
}

function extractArray(name) {
  const re = new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\];`);
  const match = existing.match(re);
  if (!match) throw new Error(`missing ${name}`);
  return [...match[1].matchAll(/\b(dispatch\w+Routes)\b/g)].map((x) => x[1]);
}

const beforePrivacy = extractArray("WORKER_ROUTE_DISPATCHERS_BEFORE_PRIVACY");
const afterPrivacy = extractArray("WORKER_ROUTE_DISPATCHERS_AFTER_PRIVACY");
const dispatchers = [
  ...beforePrivacy,
  "dispatchGdprRoutes",
  "dispatchBillingRoutes",
  ...afterPrivacy,
];

/** First-path segments that must stay eagerly imported. */
const HOT_SEGMENTS = new Set([
  "rooms",
  "messages",
  "inbox",
  "notifications",
  "agents",
  "bots",
  "webhooks",
  "search",
  "admin",
  "billing",
  "gdpr",
  "privacy",
  "users",
  "projects",
  "tokens",
  "auth",
  "presence",
  "threads",
  "reports",
  "digest",
  "handoff",
  "agent-queue",
  "templates",
  "activities",
  "api",
  "export",
  "ws",
  "collab",
]);

function resolveRouteFile(relFromLib) {
  return join(root, "lib", relFromLib);
}

function scrapeFileSegments(filePath, seen = new Set()) {
  if (seen.has(filePath)) return new Set();
  seen.add(filePath);
  let src;
  try {
    src = readFileSync(filePath, "utf8");
  } catch {
    return new Set();
  }
  const segments = new Set();

  function addPathLiteral(raw) {
    const seg = String(raw || "")
      .split("/")
      .filter(Boolean)[0];
    if (seg) segments.add(seg);
  }

  // Equality: url.pathname === "/agents" (no parentheses)
  const eqRe = /(?:url\.pathname|path)\s*(?:===|!==)\s*["'`](\/[^"'`?]*)/g;
  let pm;
  while ((pm = eqRe.exec(src)) !== null) {
    addPathLiteral(pm[1]);
  }

  // Prefix only. endsWith("/branch") is a suffix and must not become a top-level bucket.
  const startRe =
    /(?:url\.pathname|path)\s*\.\s*startsWith\s*\(\s*["'`](\/[^"'`?]*)/g;
  while ((pm = startRe.exec(src)) !== null) {
    addPathLiteral(pm[1]);
  }

  const matchRe = /(?:url\.pathname|path)\.match\(\s*\/\^\\\/([a-zA-Z][\w-]*)/g;
  while ((pm = matchRe.exec(src)) !== null) {
    segments.add(pm[1]);
  }

  const nestRe = /from\s+["'](\.\/[^"']+-http\.js)["']/g;
  while ((pm = nestRe.exec(src)) !== null) {
    const nested = join(dirname(filePath), pm[1]);
    for (const s of scrapeFileSegments(nested, seen)) segments.add(s);
  }

  return segments;
}

function scrapeSegments(fn) {
  const rel = importByFn.get(fn);
  if (!rel) return new Set();
  return scrapeFileSegments(resolveRouteFile(rel));
}

/** @type {Map<string, string[]>} */
const segmentToFns = new Map();
/** @type {string[]} */
const unscanned = [];
/** @type {Map<string, Set<string>>} */
const fnSegments = new Map();

for (const fn of dispatchers) {
  if (fn === "dispatchGdprRoutes" || fn === "dispatchBillingRoutes") {
    fnSegments.set(fn, new Set(["gdpr", "billing"]));
    continue;
  }
  const segs = scrapeSegments(fn);
  fnSegments.set(fn, segs);
  if (segs.size === 0) {
    unscanned.push(fn);
    continue;
  }
  for (const seg of segs) {
    if (!segmentToFns.has(seg)) segmentToFns.set(seg, []);
    const list = segmentToFns.get(seg);
    if (!list.includes(fn)) list.push(fn);
  }
}

for (const [seg, list] of segmentToFns) {
  segmentToFns.set(
    seg,
    dispatchers.filter((fn) => list.includes(fn)),
  );
}

function isEager(fn) {
  if (fn === "dispatchGdprRoutes" || fn === "dispatchBillingRoutes") return true;
  const segs = fnSegments.get(fn) || new Set();
  if (segs.size === 0) return false; // unscanned → lazy
  for (const s of segs) {
    if (HOT_SEGMENTS.has(s)) return true;
  }
  return false;
}

const eagerFns = new Set(dispatchers.filter(isEager));
const lazyFns = dispatchers.filter((fn) => !eagerFns.has(fn));

const missing = dispatchers.filter((fn) => !importByFn.has(fn));
if (missing.length) {
  throw new Error(
    `generate-route-dispatch: missing module path for ${missing.join(", ")}`,
  );
}

const staticImports = [...eagerFns]
  .map((fn) => `import { ${fn} } from "${importByFn.get(fn)}";`)
  .join("\n");

const lazyDecls = lazyFns
  .map((fn) => {
    const rel = importByFn.get(fn);
    return `const ${fn} = lazyRoute(() => import("${rel}"), "${fn}");`;
  })
  .join("\n");

const fmt = (arr) => arr.map((fn) => `  ${fn},`).join("\n");
const segmentEntries = [...segmentToFns.entries()]
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(
    ([seg, fns]) =>
      `  ${JSON.stringify(seg)}: [\n${fns.map((fn) => `    ${fn},`).join("\n")}\n  ],`,
  )
  .join("\n");

const unscannedFmt = unscanned.map((fn) => `  ${fn},`).join("\n");

const out = `/**
 * Central HTTP route dispatcher (P0-2 / ENG-01).
 * Prefix-indexed candidates by first path segment; unscanned modules always candidates.
 * Labs/verticals use lazyRoute() dynamic import — GA hot paths stay static.
 * Never skip by function name alone — shared prefixes stay in the same bucket.
 * Regenerate: node scripts/generate-route-dispatch.mjs
 */
${staticImports}

/**
 * @param {() => Promise<Record<string, Function>>} loader
 * @param {string} exportName
 */
function lazyRoute(loader, exportName) {
  /** @type {Function | null} */
  let cached = null;
  /** @type {Promise<Function> | null} */
  let loading = null;
  async function dispatch(request, url, deps) {
    if (!cached) {
      loading ??= loader().then((mod) => {
        cached = mod[exportName];
        return cached;
      });
      cached = await loading;
    }
    return cached(request, url, deps);
  }
  Object.defineProperty(dispatch, "name", { value: exportName });
  return dispatch;
}

${lazyDecls}

/** @type {Array<(request: Request, url: URL, deps: Record<string, unknown>) => Promise<Response|null>>} */
export const WORKER_ROUTE_DISPATCHERS_BEFORE_PRIVACY = [
${fmt(beforePrivacy)}
];

/** @type {Array<(request: Request, url: URL, deps: Record<string, unknown>) => Promise<Response|null>>} */
export const WORKER_ROUTE_DISPATCHERS_AFTER_PRIVACY = [
${fmt(afterPrivacy)}
];

const PRIVACY_BILLING_DISPATCHERS = [dispatchGdprRoutes, dispatchBillingRoutes];

/** Modules with no scraped pathname — always candidates (order preserved). */
const WORKER_ROUTE_UNSCANNED = [
${unscannedFmt}
];

/**
 * First-path-segment → candidate dispatchers (global order).
 * @type {Record<string, Array<(request: Request, url: URL, deps: Record<string, unknown>) => Promise<Response|null>>>}
 */
export const WORKER_ROUTE_PREFIX_INDEX = {
${segmentEntries}
};

export const WORKER_ROUTE_DISPATCHER_COUNT =
  WORKER_ROUTE_DISPATCHERS_BEFORE_PRIVACY.length +
  PRIVACY_BILLING_DISPATCHERS.length +
  WORKER_ROUTE_DISPATCHERS_AFTER_PRIVACY.length;

export const WORKER_ROUTE_LAZY_COUNT = ${lazyFns.length};
export const WORKER_ROUTE_EAGER_COUNT = ${eagerFns.size};

/**
 * @param {Array<(request: Request, url: URL, deps: Record<string, unknown>) => Promise<Response|null>>} ordered
 * @param {string} segment
 */
function candidatesForSegment(ordered, segment) {
  const indexed = segment ? WORKER_ROUTE_PREFIX_INDEX[segment] : null;
  if (!indexed?.length) return ordered;
  const indexedSet = new Set(indexed);
  const unscannedSet = new Set(WORKER_ROUTE_UNSCANNED);
  return ordered.filter((fn) => indexedSet.has(fn) || unscannedSet.has(fn));
}

/**
 * @param {Request} request
 * @param {URL} url
 * @param {Record<string, unknown>} routeDeps
 * @param {Record<string, unknown>} privacyBillingDeps
 * @returns {Promise<Response|null>}
 */
export async function dispatchWorkerHttpRoutes(
  request,
  url,
  routeDeps,
  privacyBillingDeps,
) {
  const segment = url.pathname.split("/").filter(Boolean)[0] || "";
  const before = candidatesForSegment(WORKER_ROUTE_DISPATCHERS_BEFORE_PRIVACY, segment);
  for (const dispatch of before) {
    const res = await dispatch(request, url, routeDeps);
    if (res) return res;
  }
  for (const dispatch of PRIVACY_BILLING_DISPATCHERS) {
    const res = await dispatch(request, url, privacyBillingDeps);
    if (res !== null) return res;
  }
  const after = candidatesForSegment(WORKER_ROUTE_DISPATCHERS_AFTER_PRIVACY, segment);
  for (const dispatch of after) {
    const res = await dispatch(request, url, routeDeps);
    if (res) return res;
  }
  return null;
}
`;

writeFileSync(dispatchPath, out, "utf8");
console.log(
  `Wrote ${dispatchers.length} dispatchers, ${segmentToFns.size} prefixes, ${unscanned.length} unscanned`,
);
console.log(`Eager static: ${eagerFns.size}, lazy dynamic: ${lazyFns.length}`);
console.log("sample prefixes:", [...segmentToFns.keys()].slice(0, 20).join(", "));
