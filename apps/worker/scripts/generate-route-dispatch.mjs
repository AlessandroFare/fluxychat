#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const workerSrc = readFileSync(join(root, "worker.js"), "utf8");
const lines = workerSrc.split("\n");

const importLines = lines
  .filter((l) => l.startsWith("import { dispatch") && l.includes("./routes/"))
  .filter((l) => !l.includes("dispatchPublicRoutes"))
  .map((l) => l.replace('"./routes/', '"../routes/'));

const order = [];
const orderRe = /await (dispatch\w+Routes)\(/g;
let m;
while ((m = orderRe.exec(workerSrc)) !== null) {
  if (m[1] === "dispatchPublicRoutes") continue;
  order.push(m[1]);
}

const dispatchers = [...new Set(order)];
const privacyIdx = dispatchers.indexOf("dispatchGdprRoutes");
if (privacyIdx < 0) throw new Error("dispatchGdprRoutes not found in order");
const beforePrivacy = dispatchers.slice(0, privacyIdx);
const privacyBilling = dispatchers.slice(privacyIdx, privacyIdx + 2);
const afterPrivacy = dispatchers.slice(privacyIdx + 2);
if (privacyBilling.join(",") !== "dispatchGdprRoutes,dispatchBillingRoutes") {
  throw new Error("unexpected privacy/billing dispatch order");
}

const fmt = (arr) => arr.map((fn) => `  ${fn},`).join("\n");

const out = `/**
 * Central HTTP route dispatcher (P0-2 / ENG-01).
 * Preserves legacy sequential dispatch order from worker.js.
 * Regenerate: node scripts/generate-route-dispatch.mjs
 */
${importLines.join("\n")}

/** @type {Array<(request: Request, url: URL, deps: Record<string, unknown>) => Promise<Response|null>>} */
export const WORKER_ROUTE_DISPATCHERS_BEFORE_PRIVACY = [
${fmt(beforePrivacy)}
];

/** @type {Array<(request: Request, url: URL, deps: Record<string, unknown>) => Promise<Response|null>>} */
export const WORKER_ROUTE_DISPATCHERS_AFTER_PRIVACY = [
${fmt(afterPrivacy)}
];

const PRIVACY_BILLING_DISPATCHERS = [dispatchGdprRoutes, dispatchBillingRoutes];

export const WORKER_ROUTE_DISPATCHER_COUNT =
  WORKER_ROUTE_DISPATCHERS_BEFORE_PRIVACY.length +
  PRIVACY_BILLING_DISPATCHERS.length +
  WORKER_ROUTE_DISPATCHERS_AFTER_PRIVACY.length;

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
  for (const dispatch of WORKER_ROUTE_DISPATCHERS_BEFORE_PRIVACY) {
    const res = await dispatch(request, url, routeDeps);
    if (res) return res;
  }
  for (const dispatch of PRIVACY_BILLING_DISPATCHERS) {
    const res = await dispatch(request, url, privacyBillingDeps);
    if (res !== null) return res;
  }
  for (const dispatch of WORKER_ROUTE_DISPATCHERS_AFTER_PRIVACY) {
    const res = await dispatch(request, url, routeDeps);
    if (res) return res;
  }
  return null;
}
`;

writeFileSync(join(root, "lib", "worker-route-dispatch.js"), out, "utf8");
console.log(`Wrote ${dispatchers.length} dispatchers to lib/worker-route-dispatch.js`);
