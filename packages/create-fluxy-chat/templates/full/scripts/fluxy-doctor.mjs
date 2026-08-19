#!/usr/bin/env node
/**
 * Verify .env, worker health, demo/local readiness, and agent config.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const green = (s) => c("32", s);
const red = (s) => c("31", s);
const yellow = (s) => c("33", s);
const bold = (s) => c("1", s);

let failures = 0;
let warnings = 0;

function pass(msg) {
  console.log(`  ${green("✓")} ${msg}`);
}
function warn(msg) {
  warnings += 1;
  console.log(`  ${yellow("!")} ${msg}`);
}
function fail(msg) {
  failures += 1;
  console.log(`  ${red("✗")} ${msg}`);
}

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

async function fetchOk(url, init = {}) {
  try {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(5000) });
    return { ok: r.ok, status: r.status, json: r.headers.get("content-type")?.includes("json") ? await r.json().catch(() => null) : null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  console.log(bold("\nFluxyChat doctor\n"));

  const env = parseEnvFile(envPath);
  if (!existsSync(envPath)) {
    fail(".env missing — run: pnpm setup");
  } else {
    pass(".env exists");
  }

  const workerUrl = env.VITE_FLUXYCHAT_WORKER_URL || process.env.FLUXY_WORKER_URL;
  const jwt = env.VITE_FLUXYCHAT_MEMBER_JWT;
  const roomId = env.VITE_FLUXYCHAT_ROOM_ID;
  const agentId = env.VITE_FLUXYCHAT_AGENT_ID;

  if (!workerUrl) fail("VITE_FLUXYCHAT_WORKER_URL unset");
  else pass(`worker URL: ${workerUrl}`);

  const hosted = (env.VITE_FLUXYCHAT_CONSOLE_URL || "").includes("fluxychat.com");
  if (!jwt) {
    if (hosted) warn("VITE_FLUXYCHAT_MEMBER_JWT unset — sign in from the app (Clerk)");
    else fail("VITE_FLUXYCHAT_MEMBER_JWT unset");
  } else pass(`JWT present (${jwt.length} chars)`);

  if (!roomId) warn("VITE_FLUXYCHAT_ROOM_ID unset");
  else pass(`room: ${roomId}`);

  if (!agentId) warn("VITE_FLUXYCHAT_AGENT_ID unset — agent invoke disabled");
  else pass(`agent: ${agentId}`);

  if (workerUrl) {
    const health = await fetchOk(`${workerUrl}/health`);
    if (health.ok) pass("worker /health OK");
    else fail(`worker /health failed${health.error ? `: ${health.error}` : ` (${health.status})`}`);

    const demoStatus = await fetchOk(`${workerUrl}/demo/status`);
    if (demoStatus.ok && demoStatus.json?.ready) {
      pass("public demo available (/demo/status)");
    } else if (workerUrl.includes("127.0.0.1") || workerUrl.includes("localhost")) {
      pass("local worker (demo status optional)");
    } else {
      warn("public demo not ready on this worker");
    }
  }

  if (workerUrl && jwt && roomId) {
    const rooms = await fetchOk(`${workerUrl}/rooms`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (rooms.ok) {
      const list = Array.isArray(rooms.json?.rooms) ? rooms.json.rooms : [];
      if (list.some((r) => r?.id === roomId)) pass(`room membership OK (${roomId})`);
      else warn(`room ${roomId} not listed for this JWT`);
    } else {
      warn(`GET /rooms failed (${rooms.status ?? rooms.error})`);
    }
  }

  console.log("");
  if (failures > 0) {
    console.log(red(bold(`${failures} check(s) failed`)) + (warnings ? ` · ${warnings} warning(s)` : ""));
    process.exit(1);
  }
  console.log(green(bold("All checks passed")) + (warnings ? ` · ${warnings} warning(s)` : ""));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
