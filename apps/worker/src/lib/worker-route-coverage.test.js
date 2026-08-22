import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  WORKER_ROUTE_DISPATCHERS_AFTER_PRIVACY,
  WORKER_ROUTE_DISPATCHERS_BEFORE_PRIVACY,
  WORKER_ROUTE_PREFIX_INDEX,
} from "./worker-route-dispatch.js";

const here = dirname(fileURLToPath(import.meta.url));
const workerSrc = join(here, "..");
const routesDir = join(workerSrc, "routes");
const dispatchPath = join(here, "worker-route-dispatch.js");
const repoRoot = join(workerSrc, "..", "..");

const EARLY_FILES = new Set([
  "public-http.js",
  "dev-provision-http.js",
  "gdpr-http.js",
  "billing-http.js",
]);
const ALWAYS_ON = new Set(["dispatchGdprRoutes", "dispatchBillingRoutes"]);
const ALWAYS_ON_SEGMENTS = new Set(["gdpr", "billing"]);

function firstSegmentsInSource(src) {
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

function nestedHttpFiles(filePath, seen = new Set()) {
  if (seen.has(filePath)) return seen;
  seen.add(filePath);
  let src;
  try {
    src = readFileSync(filePath, "utf8");
  } catch {
    return seen;
  }
  const nestRe = /from\s+["'](\.\/[^"']+-http\.js)["']/g;
  let pm;
  while ((pm = nestRe.exec(src)) !== null) {
    nestedHttpFiles(join(dirname(filePath), pm[1]), seen);
  }
  return seen;
}

function dispatcherImports() {
  const src = readFileSync(dispatchPath, "utf8");
  const map = new Map();
  for (const line of src.split("\n")) {
    const staticImp = line.match(/import \{ (\w+) \} from "([^"]+)"/);
    if (staticImp) map.set(staticImp[1], join(here, staticImp[2]));
    const lazyImp = line.match(
      /const (\w+) = lazyRoute\(\(\) => import\("([^"]+)"\),\s*"\1"\)/,
    );
    if (lazyImp) map.set(lazyImp[1], join(here, lazyImp[2]));
  }
  return map;
}

function walkFiles(dir, exts, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === "dist" || name === ".next") continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walkFiles(full, exts, out);
    else if (exts.some((ext) => name.endsWith(ext))) out.push(full);
  }
  return out;
}

function clientPathSegments(text) {
  const segs = new Set();
  const patterns = [
    /https:\/\/fluxy\.local(\/[A-Za-z][\w.-]*)/g,
    /\$\{(?:WORKER_URL|workerUrl|baseUrl|base|workerBase|WORKER)\}(\/[A-Za-z][\w.-]*)/g,
    /new URL\(\s*["'`](\/[A-Za-z][\w.-]*)/g,
  ];
  for (const re of patterns) {
    let pm;
    while ((pm = re.exec(text)) !== null) {
      const seg = pm[1].split("/").filter(Boolean)[0];
      if (seg) segs.add(seg);
    }
  }
  return segs;
}

describe("worker HTTP prefix coverage", () => {
  const imports = dispatcherImports();
  const listed = [
    ...WORKER_ROUTE_DISPATCHERS_BEFORE_PRIVACY,
    ...WORKER_ROUTE_DISPATCHERS_AFTER_PRIVACY,
  ];

  it("wires every *-http.js except public/dev early handlers", () => {
    const reachable = new Set();
    for (const fn of listed) {
      const file = imports.get(fn.name);
      if (!file) continue;
      for (const nested of nestedHttpFiles(file)) {
        reachable.add(nested.replaceAll("\\", "/").split("/routes/").pop());
      }
    }
    const orphans = readdirSync(routesDir)
      .filter((f) => f.endsWith("-http.js") && !EARLY_FILES.has(f))
      .filter((f) => !reachable.has(f));
    expect(orphans).toEqual([]);
  });

  it("puts each dispatcher on every first-path segment it actually serves", () => {
    const gaps = [];
    for (const fn of listed) {
      if (ALWAYS_ON.has(fn.name)) continue;
      const file = imports.get(fn.name);
      if (!file) {
        gaps.push(`${fn.name}: missing import`);
        continue;
      }
      const segs = new Set();
      for (const nested of nestedHttpFiles(file)) {
        for (const s of firstSegmentsInSource(readFileSync(nested, "utf8"))) segs.add(s);
      }
      for (const seg of segs) {
        const names = (WORKER_ROUTE_PREFIX_INDEX[seg] ?? []).map((d) => d.name);
        if (!names.includes(fn.name)) {
          gaps.push(`${fn.name} missing from PREFIX_INDEX.${seg}`);
        }
      }
    }
    expect(gaps).toEqual([]);
  });

  it("indexes collab, rooms branch, and agents list on the composite dispatcher", () => {
    const names = (seg) => (WORKER_ROUTE_PREFIX_INDEX[seg] ?? []).map((d) => d.name);
    expect(names("collab")).toContain("dispatchCollabRoutes");
    expect(names("agents")).toContain("dispatchMessagesAgentsRoutes");
    expect(names("rooms")).toContain("dispatchMessagesAgentsRoutes");
    expect(names("rooms")).toContain("dispatchRoomsMutationsRoutes");
    expect(WORKER_ROUTE_PREFIX_INDEX.branch).toBeUndefined();
  });

  it("covers first-path segments used by e2e tests, dashboard, and SDK", () => {
    const early = firstSegmentsInSource(
      readFileSync(join(routesDir, "public-http.js"), "utf8"),
    );
    early.add("dev");

    const clientSegs = new Set();
    const files = [
      join(workerSrc, "worker.e2e.test.js"),
      ...walkFiles(join(repoRoot, "apps", "dashboard"), [".ts", ".tsx"]),
      ...walkFiles(join(repoRoot, "packages", "sdk", "src"), [".ts"]),
    ];
    for (const file of files) {
      let text;
      try {
        text = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      for (const s of clientPathSegments(text)) clientSegs.add(s);
    }

    const indexed = new Set(Object.keys(WORKER_ROUTE_PREFIX_INDEX));
    const missing = [...clientSegs]
      .filter((s) => !indexed.has(s) && !early.has(s) && !ALWAYS_ON_SEGMENTS.has(s))
      .sort();
    expect(missing).toEqual([]);
  });
});
