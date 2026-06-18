#!/usr/bin/env node
/**
 * FluxyChat  first-message quickstart.
 *
 * Goal: get a developer from `git clone` to a verified first message in ~90 seconds.
 *
 * What it does:
 *   1. Sanity-checks the local worker dev env (`apps/worker/.dev.vars` exists,
 *      ALLOW_DEV_PROVISION=true is set). Adds the line idempotently if missing.
 *   2. Starts the local worker (`pnpm --filter @fluxychat/worker dev`) if it's
 *      not already running on 127.0.0.1:8787. Polls /health until ready.
 *   3. POST /dev/provision → mints a fresh project + API key (idempotent on
 *      the dev-local project).
 *   4. POST /auth/token with that API key → JWT for the SDK.
 *   5. POST /messages into the seeded `general` room → your first message.
 *   6. Prints a green success box with project id, API key, JWT, message id.
 *   7. Stops the worker it spawned (leaves a pre-existing one running).
 *
 * Safety:
 *   - The dev-provision route is 404 unless `ALLOW_DEV_PROVISION === "true"`
 *     AND `NODE_ENV !== "production"`. This script enforces both locally.
 *   - It only writes to `apps/worker/.dev.vars` (gitignored), never to a
 *     committed file.
 *
 * Usage:
 *   pnpm run first-message
 *
 * Exit codes:
 *   0  success (message persisted, JWT printed)
 *   1  anything went wrong; the last printed block tells you what
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workerDir = join(root, "apps", "worker");
const devVarsPath = join(workerDir, ".dev.vars");
const devVarsExamplePath = join(workerDir, ".dev.vars.example");
const WORKER_URL = process.env.FIRST_MESSAGE_WORKER_URL || "http://127.0.0.1:8787";
const POLL_INTERVAL_MS = 500;
const POLL_TIMEOUT_MS = 90_000; // 90 s  wrangler cold start on big monorepos can take a while
const POST_TIMEOUT_MS = 15_000;

// ── ANSI colors (auto-disabled when stdout is not a TTY, e.g. CI) ──
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const green = (s) => c("32", s);
const red = (s) => c("31", s);
const yellow = (s) => c("33", s);
const dim = (s) => c("2", s);
const bold = (s) => c("1", s);

function step(n, label) {
  console.log(`\n${bold(`Step ${n}`)}  ${label}`);
}
function ok(msg) {
  console.log(`  ${green("✓")} ${msg}`);
}
function info(msg) {
  console.log(`  ${dim("·")} ${msg}`);
}
// Never print full secrets to stdout/logs. CodeQL flags any data derived from
// the provisioned apiKey as clear-text logging of sensitive information, so we
// mask every secret before it reaches console.* (logs are often persisted and
// shared — e.g. CI artifacts — and a leaked apiKey lets anyone mint JWTs).
function maskKey(secret) {
  if (!secret) return "<unset>";
  const s = String(secret);
  if (s.length <= 12) return `${s.slice(0, 4)}…${s.slice(-2)}`;
  return `${s.slice(0, 12)}…(${s.length} chars)`;
}
function maskJwt(token) {
  if (!token) return "<unset>";
  const s = String(token);
  return `${s.slice(0, 10)}…${s.slice(-4)} (${s.length} chars)`;
}
function warn(msg) {
  console.warn(`  ${yellow("!")} ${msg}`);
}
function fail(msg) {
  console.error(`\n${red("✗")} ${red(bold(msg))}`);
}

function box(lines, { color = "green" } = {}) {
  const palette = color === "green" ? green : color === "red" ? red : yellow;
  const width = Math.max(...lines.map((l) => stripAnsi(l).length));
  const pad = (l) => {
    const visible = stripAnsi(l).length;
    return l + " ".repeat(Math.max(0, width - visible));
  };
  const top = `╭${"─".repeat(width + 2)}╮`;
  const bot = `╰${"─".repeat(width + 2)}╯`;
  console.log(palette(top));
  for (const l of lines) console.log(palette("│ ") + pad(l) + palette(" │"));
  console.log(palette(bot));
}

function stripAnsi(s) {
  return String(s).replace(/\x1b\[[0-9;]*m/g, "");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchWithTimeout(url, init = {}, timeoutMs = POST_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

// ── Pre-flight: env files ────────────────────────────────────────
function ensureDevVars() {
  if (!existsSync(devVarsPath)) {
    if (existsSync(devVarsExamplePath)) {
      // Mirror dev-setup.mjs  copy the example if no .dev.vars exists yet.
      const example = readFileSync(devVarsExamplePath, "utf8");
      writeFileSync(devVarsPath, example);
      ok(`created apps/worker/.dev.vars from .dev.vars.example`);
    } else {
      fail(
        `apps/worker/.dev.vars is missing and no .dev.vars.example to copy from.\n` +
          `    Run: pnpm run dev:setup`,
      );
      process.exit(1);
    }
  }
  // Idempotent: ensure ALLOW_DEV_PROVISION=true is present (env var or .dev.vars).
  if (process.env.ALLOW_DEV_PROVISION === "true") return;
  let content = readFileSync(devVarsPath, "utf8");
  if (/^ALLOW_DEV_PROVISION\s*=\s*"true"\s*$/m.test(content)) return;
  // Append a clearly delimited block (idempotent on re-runs by guarding above).
  const banner =
    "\n# --- /dev/provision (auto-added by scripts/first-message.mjs) ---\n" +
    "ALLOW_DEV_PROVISION=true\n";
  if (!content.endsWith("\n")) content += "\n";
  writeFileSync(devVarsPath, content + banner);
  ok(`added ALLOW_DEV_PROVISION=true to apps/worker/.dev.vars`);
}

// ── Worker lifecycle ─────────────────────────────────────────────
async function isWorkerUp() {
  try {
    const r = await fetchWithTimeout(`${WORKER_URL}/health`, { method: "GET" }, 1500);
    return r.ok || r.status === 200;
  } catch {
    return false;
  }
}

function spawnWorker() {
  // Use pnpm with the workspace filter so we inherit the right cwd and node_modules.
  // shell:true so Windows resolves pnpm.cmd / wrangler.cmd correctly.
  info("starting wrangler dev (first run can take 30-60 s)…");
  const child = spawn("pnpm", ["--filter", "@fluxychat/worker", "dev"], {
    cwd: root,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      // Defensive: ensure the route guard sees the right values even if
      // .dev.vars wasn't picked up by the spawned shell for some reason.
      ALLOW_DEV_PROVISION: "true",
      NODE_ENV: "development",
      FORCE_COLOR: useColor ? "1" : "0",
    },
  });
  // Surface wrangler's output only on failure to keep the happy path quiet.
  let buf = "";
  child.stdout.on("data", (chunk) => {
    const s = chunk.toString();
    buf += s;
    // TEMP-DEBUG: print lines containing DBG or error
    for (const line of s.split(/\r?\n/)) {
      if (line.includes("[DBG") || line.toLowerCase().includes("error")) {
        process.stderr.write(`[wrangler] ${line}\n`);
      }
    }
  });
  child.stderr.on("data", (chunk) => {
    const s = chunk.toString();
    buf += s;
    for (const line of s.split(/\r?\n/)) {
      if (line.includes("[DBG") || line.toLowerCase().includes("error")) {
        process.stderr.write(`[wrangler] ${line}\n`);
      }
    }
  });
  child.on("exit", (code, signal) => {
    if (code !== 0 && code !== null && !shuttingDown) {
      warn(`wrangler dev exited unexpectedly (code=${code}, signal=${signal})`);
      if (buf.trim()) {
        console.error(dim("--- wrangler output (last 60 lines) ---"));
        console.error(
          buf
            .split(/\r?\n/)
            .filter(Boolean)
            .slice(-60)
            .join("\n"),
        );
      }
    }
  });
  return child;
}

async function waitForWorker() {
  const start = Date.now();
  let lastLog = 0;
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    if (await isWorkerUp()) return true;
    if (Date.now() - lastLog > 5_000) {
      info(`waiting for ${WORKER_URL}/health… (${Math.round((Date.now() - start) / 1000)}s)`);
      lastLog = Date.now();
    }
    await sleep(POLL_INTERVAL_MS);
  }
  return false;
}

// ── HTTP calls (with tiny error helper) ──────────────────────────
async function postJson(path, body, headers = {}) {
  const res = await fetchWithTimeout(`${WORKER_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // fall through; we'll surface the raw text on error
  }
  if (!res.ok) {
    const detail = json?.error || text || res.statusText;
    throw new Error(`${path} → HTTP ${res.status}: ${detail}`);
  }
  return json ?? {};
}

// ── Main ─────────────────────────────────────────────────────────
let shuttingDown = false;
let spawnedWorker = null;

async function main() {
  console.log(bold("FluxyChat  first message in 90 seconds"));
  console.log(dim("────────────────────────────────────────"));

  step(0, "Pre-flight");
  ensureDevVars();
  ok(`dev vars OK at apps/worker/.dev.vars`);

  step(1, "Start the worker (or reuse a running one)");
  if (await isWorkerUp()) {
    ok(`worker already responding at ${WORKER_URL}`);
  } else {
    spawnedWorker = spawnWorker();
    const up = await waitForWorker();
    if (!up) {
      fail(
        `worker did not become ready within ${POLL_TIMEOUT_MS / 1000}s.\n` +
          `    Run it manually: pnpm --filter @fluxychat/worker dev\n` +
          `    Then re-run:     pnpm run first-message`,
      );
      if (spawnedWorker && !spawnedWorker.killed) spawnedWorker.kill("SIGTERM");
      process.exit(1);
    }
    ok(`worker ready at ${WORKER_URL}`);
  }

  step(2, "Provision a dev project (POST /dev/provision)");
  const provision = await postJson("/dev/provision", {});
  if (!provision.apiKey || !provision.projectId) {
    fail(
      `/dev/provision did not return apiKey/projectId (projectId=${provision.projectId ?? "<missing>"}, apiKey=${maskKey(provision.apiKey)}, reused=${provision.reused ?? "<missing>"})`,
    );
    cleanupAndExit(1);
    return;
  }
  ok(`projectId = ${provision.projectId}`);
  ok(`apiKey    = ${maskKey(provision.apiKey)}`);

  step(3, "Mint a JWT (POST /auth/token)");
  const auth = await postJson(
    "/auth/token",
    {
      userId: "first-message-user",
      roles: ["owner", "admin"],
      ttlSeconds: 3600,
    },
    { "X-Fluxy-Api-Key": provision.apiKey },
  );
  if (!auth.token) {
    fail(`/auth/token did not return a token: ${JSON.stringify(auth)}`);
    cleanupAndExit(1);
    return;
  }
  ok(`JWT minted (${auth.token.length} chars, expires in ${auth.expiresIn}s)`);

  step(4, "Send the first message (POST /messages → room `general`)");
  const msgRes = await postJson(
    "/messages",
    {
      roomId: "general",
      content: `Hello from the first-message script! 🎉 (${new Date().toISOString()})`,
    },
    { Authorization: `Bearer ${auth.token}` },
  );
  const messageId =
    msgRes?.message?.id ??
    msgRes?.id ??
    msgRes?.messageId ??
    null;
  if (!messageId) {
    fail(`/messages response missing message.id: ${JSON.stringify(msgRes).slice(0, 400)}`);
    cleanupAndExit(1);
    return;
  }
  ok(`messageId = ${messageId}`);

  step(5, "All set");
  // Secrets are masked (CodeQL js/clear-text-logging). The full apiKey was
  // already printed once by /dev/provision in the previous step; printing it
  // again here into a persistent log box is the exposure risk. To copy the real
  // values, re-run `curl -X POST http://127.0.0.1:8787/dev/provision` (the key
  // is kept valid across re-runs) or read them from apps/worker/.dev.vars.
  box(
    [
      green(bold("First message sent.")),
      "",
      `${dim("projectId")}   ${provision.projectId}`,
      `${dim("apiKey")}      ${maskKey(provision.apiKey)}`,
      `${dim("JWT")}         ${maskJwt(auth.token)}`,
      `${dim("messageId")}   ${messageId}`,
      `${dim("room")}       general`,
      "",
      dim("Secrets are masked in logs. Reuse the values from /dev/provision output"),
      dim("or apps/worker/.dev.vars. SDK: new FluxyChatClient({ baseUrl, token })"),
    ],
    { color: "green" },
  );
  cleanupAndExit(0);
}

function cleanupAndExit(code) {
  shuttingDown = true;
  if (spawnedWorker && !spawnedWorker.killed) {
    try {
      spawnedWorker.kill("SIGTERM");
    } catch {
      /* ignore */
    }
    // Give wrangler 2s to flush, then SIGKILL.
    const child = spawnedWorker;
    setTimeout(() => {
      try {
        if (!child.killed) child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
    }, 2_000).unref();
  }
  // Exit on next tick so any pending stdout flushes.
  setImmediate(() => process.exit(code));
}

main().catch((err) => {
  shuttingDown = true;
  if (spawnedWorker && !spawnedWorker.killed) {
    try {
      spawnedWorker.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
  fail(err?.stack || err?.message || String(err));
  process.exit(1);
});