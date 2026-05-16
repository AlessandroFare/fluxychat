#!/usr/bin/env node
/**
 * Post-deploy smoke: /health + stats endpoints (requires admin JWT with `tid` claim).
 *
 * Usage:
 *   node scripts/smoke-remote.mjs --base-url https://your-worker.example --admin-jwt "<JWT>"
 *
 * Env (optional):
 *   SMOKE_BASE_URL, SMOKE_ADMIN_JWT
 */

import process from "node:process";

function parseArgs(argv) {
  const map = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : "true";
    map.set(key, value);
    if (value !== "true") i += 1;
  }
  return {
    baseUrl: String(
      map.get("base-url") || process.env.SMOKE_BASE_URL || ""
    ).replace(/\/+$/, ""),
    adminJwt: String(map.get("admin-jwt") || process.env.SMOKE_ADMIN_JWT || ""),
  };
}

async function fetchJson(url, headers) {
  const res = await fetch(url, { headers });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { _raw: text.slice(0, 500) };
  }
  return { res, body };
}

async function main() {
  const { baseUrl, adminJwt } = parseArgs(process.argv.slice(2));
  if (!baseUrl) {
    console.error("Missing --base-url or SMOKE_BASE_URL");
    process.exit(2);
  }
  if (!adminJwt) {
    console.error("Missing --admin-jwt or SMOKE_ADMIN_JWT (JWT with roles owner|admin|moderator)");
    process.exit(2);
  }

  const authHeaders = { Authorization: `Bearer ${adminJwt}` };
  const failures = [];

  const healthUrl = `${baseUrl}/health`;
  const h = await fetchJson(healthUrl, {});
  console.log(`GET ${healthUrl} -> ${h.res.status}`);
  if (!h.res.ok) failures.push(`/health status ${h.res.status}`);
  if (h.body && h.body.ok !== true) failures.push(`/health body.ok !== true (got ${h.body.ok})`);
  if (h.body?.degraded) {
    console.warn("Warning: health reports degraded (KV/R2 optional bindings).");
  }

  const statPaths = [
    "/stats/slo?minutes=15",
    "/stats/costs",
    "/stats/launch-kpis",
  ];
  for (const p of statPaths) {
    const url = `${baseUrl}${p}`;
    const { res, body } = await fetchJson(url, authHeaders);
    console.log(`GET ${url} -> ${res.status}`);
    if (!res.ok) failures.push(`${p} -> ${res.status}`);
    if (res.ok && body?.error) failures.push(`${p} -> json error: ${body.error}`);
  }

  if (failures.length) {
    console.error("\nSmoke FAILED:");
    for (const f of failures) console.error(` - ${f}`);
    process.exit(1);
  }
  console.log("\nSmoke OK (health + stats/slo + stats/costs + stats/launch-kpis).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
