#!/usr/bin/env node
/**
 * Provision credentials and write .env for the full template.
 *
 * Modes:
 *   local / self-host — POST /dev/provision on your worker (ALLOW_DEV_PROVISION=true)
 *   hosted            — Clerk on fluxychat.com (no wrangler)
 *
 * Usage:
 *   pnpm setup
 *   pnpm setup -- --mode hosted
 *   pnpm setup -- --mode self-host
 *   FLUXY_SETUP_MODE=hosted pnpm setup
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");
const metaPath = join(root, ".fluxy", "setup.json");
const modePath = join(root, ".fluxy", "mode");
const answersPath = join(root, ".fluxy", "answers.json");

const HOSTED_WORKER_DEFAULT = "https://api.fluxychat.com";
const HOSTED_CONSOLE_DEFAULT = "https://fluxychat.com";
const LOCAL_WORKER_DEFAULT = "http://127.0.0.1:8787";
const LOCAL_CONSOLE_DEFAULT = "http://localhost:3000";
const POST_TIMEOUT_MS = 15_000;

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const green = (s) => c("32", s);
const red = (s) => c("31", s);
const dim = (s) => c("2", s);
const bold = (s) => c("1", s);

function ok(msg) {
  console.log(`  ${green("✓")} ${msg}`);
}
function fail(msg) {
  console.error(`\n${red("✗")} ${red(bold(msg))}`);
  process.exit(1);
}

function parseSetupMode(raw) {
  const m = String(raw || "").trim().toLowerCase();
  if (m === "hosted") return "hosted";
  if (m === "local" || m === "self-host") return "local";
  return null;
}

function readAnswers() {
  if (!existsSync(answersPath)) return {};
  try {
    return JSON.parse(readFileSync(answersPath, "utf8"));
  } catch {
    return {};
  }
}

function promptLine(question, fallback) {
  if (!process.stdin.isTTY) return Promise.resolve(fallback);
  return new Promise((resolveAnswer) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`${question} [${fallback}]: `, (answer) => {
      rl.close();
      resolveAnswer(String(answer || "").trim() || fallback);
    });
  });
}

function readDefaultMode() {
  if (existsSync(modePath)) {
    const parsed = parseSetupMode(readFileSync(modePath, "utf8"));
    if (parsed) return parsed;
  }
  const fromAnswers = parseSetupMode(readAnswers().mode);
  if (fromAnswers) return fromAnswers;
  return "local";
}

function resolveMode() {
  const argv = process.argv.slice(2);
  const flagIdx = argv.indexOf("--mode");
  if (flagIdx >= 0 && argv[flagIdx + 1]) {
    const parsed = parseSetupMode(argv[flagIdx + 1]);
    if (parsed) return parsed;
    fail(`Unknown mode "${argv[flagIdx + 1]}". Use: local | self-host | hosted`);
  }
  const fromEnv = parseSetupMode(process.env.FLUXY_SETUP_MODE);
  if (fromEnv) return fromEnv;
  return readDefaultMode();
}

function fetchWithTimeout(url, init = {}, timeoutMs = POST_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

async function isWorkerUp(workerUrl) {
  try {
    const r = await fetchWithTimeout(`${workerUrl}/health`, { method: "GET" }, 2000);
    return r.ok;
  } catch {
    return false;
  }
}

async function postJson(workerUrl, path, body, headers = {}) {
  const res = await fetchWithTimeout(`${workerUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const detail = json?.error || text || res.statusText;
    throw new Error(`${path} → HTTP ${res.status}: ${detail}`);
  }
  return json ?? {};
}

async function getJson(workerUrl, path, headers = {}) {
  const res = await fetchWithTimeout(`${workerUrl}${path}`, { method: "GET", headers });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const detail = json?.error || text || res.statusText;
    throw new Error(`${path} → HTTP ${res.status}: ${detail}`);
  }
  return json ?? {};
}

function quickstartRoomId(projectId) {
  return `${projectId}-general`;
}

async function ensureRoom(workerUrl, token, projectId) {
  const roomId = quickstartRoomId(projectId);
  const listed = await getJson(workerUrl, "/rooms", { Authorization: `Bearer ${token}` });
  const rooms = Array.isArray(listed?.rooms) ? listed.rooms : [];
  if (rooms.some((room) => room?.id === roomId)) {
    ok(`room ${roomId} ready`);
    return roomId;
  }
  try {
    await postJson(
      workerUrl,
      "/rooms",
      { id: roomId, type: "public", name: "General" },
      { Authorization: `Bearer ${token}` },
    );
    ok(`room ${roomId} created`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("409") || msg.includes("room_id_already_exists")) {
      ok(`room ${roomId} exists`);
    } else {
      throw err;
    }
  }
  return roomId;
}

async function resolveAssistantAgent(workerUrl, token) {
  const data = await getJson(workerUrl, "/agents", { Authorization: `Bearer ${token}` });
  const agents = Array.isArray(data?.agents) ? data.agents : Array.isArray(data) ? data : [];
  const assistant =
    agents.find((a) => a?.handle === "@assistant") ??
    agents.find((a) => String(a?.handle ?? "").includes("assistant")) ??
    agents[0];
  if (!assistant?.id) {
    fail("No agents found. Ensure worker migrations ran (built-in @assistant seed).");
  }
  ok(`agent ${assistant.handle ?? assistant.id}`);
  return { id: String(assistant.id), handle: String(assistant.handle ?? "@assistant") };
}

function writeEnv(vars) {
  const lines = [
    "# Auto-generated by pnpm setup — do not commit secrets",
    `VITE_FLUXYCHAT_WORKER_URL=${vars.workerUrl}`,
    `VITE_FLUXYCHAT_PUBLISHABLE_KEY=${vars.publishableKey || ""}`,
    `VITE_FLUXYCHAT_MEMBER_JWT=${vars.token}`,
    `VITE_FLUXYCHAT_ROOM_ID=${vars.roomId}`,
    `VITE_FLUXYCHAT_AGENT_ID=${vars.agentId}`,
    `VITE_FLUXYCHAT_AGENT_HANDLE=${vars.agentHandle}`,
    `VITE_FLUXYCHAT_PROJECT_ID=${vars.projectId}`,
    `VITE_FLUXYCHAT_USER_ID=${vars.userId}`,
    `VITE_FLUXYCHAT_CONSOLE_URL=${vars.consoleUrl}`,
    "",
  ];
  writeFileSync(envPath, lines.join("\n"));
  ok(`wrote ${envPath}`);
}

function writeMeta(meta) {
  mkdirSync(dirname(metaPath), { recursive: true });
  writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
}

async function setupHosted() {
  const workerUrl =
    process.env.FLUXY_HOSTED_WORKER_URL ||
    process.env.FLUXY_WORKER_URL ||
    HOSTED_WORKER_DEFAULT;
  const consoleUrl = process.env.FLUXY_CONSOLE_URL || HOSTED_CONSOLE_DEFAULT;
  const fromEnvPk = (process.env.FLUXY_PUBLISHABLE_KEY || process.env.VITE_FLUXYCHAT_PUBLISHABLE_KEY || "").trim();

  console.log(dim(`  mode: hosted · worker: ${workerUrl}`));

  let publishableKey = fromEnvPk.startsWith("pk_") ? fromEnvPk : "";
  let roomId = process.env.VITE_FLUXYCHAT_ROOM_ID?.trim() || "";
  if (!publishableKey) {
    try {
      const demo = await getJson(workerUrl, "/public/demo-credentials");
      if (demo?.publishableKey?.startsWith("pk_")) {
        publishableKey = demo.publishableKey;
        roomId = demo.roomId || roomId || "general";
        ok("wrote public demo pk_ (GET /public/demo-credentials)");
      }
    } catch {
      /* demo not configured on this Worker */
    }
  }

  writeEnv({
    workerUrl,
    publishableKey,
    token: "",
    roomId: roomId || (publishableKey ? "general" : ""),
    agentId: "",
    agentHandle: "@assistant",
    projectId: "",
    userId: "",
    consoleUrl,
  });

  writeMeta({
    mode: "hosted",
    workerUrl,
    projectId: null,
    roomId: roomId || null,
    agentId: null,
    agentHandle: "@assistant",
    setupAt: new Date().toISOString(),
    auth: publishableKey ? "publishableKey" : "clerk",
  });

  if (publishableKey) {
    ok("public room is ready. pnpm dev — no Clerk required");
    console.log(dim("  Sign in later for a private assistant room: Open dashboard"));
  } else {
    ok("wrote hosted endpoints (copy a pk_ from the console, or sign in on pnpm dev)");
    console.log(dim("  Run: pnpm dev"));
    console.log(dim(`  Console: ${consoleUrl}/onboarding`));
    console.log(dim("  Hosted ops: set PUBLIC_DEMO_PUBLISHABLE_KEY on the Worker for a no-account path"));
  }
}

async function setupLocal() {
  const answers = readAnswers();
  let workerUrl =
    process.env.FLUXY_WORKER_URL ||
    process.env.FLUXYCHAT_WORKER_URL ||
    answers.workerUrl ||
    LOCAL_WORKER_DEFAULT;
  const consoleUrl =
    process.env.FLUXY_CONSOLE_URL || answers.consoleUrl || LOCAL_CONSOLE_DEFAULT;

  console.log(dim(`  mode: local · worker: ${workerUrl}`));

  if (!(await isWorkerUp(workerUrl))) {
    console.log(
      dim(
        `\n  Worker not reachable at ${workerUrl}.\n` +
          "  Clone FluxyChat, then:\n" +
          "    pnpm install && pnpm run self-host\n" +
          "    pnpm --filter @fluxy-chat/worker dev\n" +
          "  Merge this project's .fluxy/worker.dev.vars into apps/worker/.dev.vars\n",
      ),
    );
    if (process.stdin.isTTY) {
      for (let i = 0; i < 3; i += 1) {
        workerUrl = await promptLine("Worker URL", workerUrl);
        if (await isWorkerUp(workerUrl)) break;
        console.log(dim(`  Still down at ${workerUrl}`));
      }
    }
    if (!(await isWorkerUp(workerUrl))) {
      fail(
        `Worker not reachable at ${workerUrl}\n` +
          "  Start it from the FluxyChat monorepo:\n" +
          "    pnpm run self-host && pnpm --filter @fluxy-chat/worker dev\n" +
          "  Or use hosted mode:\n" +
          "    pnpm setup -- --mode hosted",
      );
    }
  }
  ok(`worker healthy at ${workerUrl}`);

  const provision = await postJson(workerUrl, "/dev/provision", {});
  if (!provision.projectId) {
    fail("/dev/provision did not return projectId (is ALLOW_DEV_PROVISION=true?)");
  }
  ok(`projectId = ${provision.projectId}`);

  let apiKey = provision.apiKey;
  if (!apiKey && provision.reused) {
    const fromEnv = process.env.FLUXY_CONSOLE_API_KEY || process.env.FIRST_MESSAGE_API_KEY;
    if (fromEnv?.startsWith("fc_")) apiKey = fromEnv;
    if (!apiKey && existsSync(join(root, "..", "..", "apps", "worker", ".dev.vars"))) {
      const devVars = readFileSync(join(root, "..", "..", "apps", "worker", ".dev.vars"), "utf8");
      const m = devVars.match(/^FLUXY_CONSOLE_API_KEY\s*=\s*(.+)$/m);
      if (m?.[1]?.startsWith("fc_")) apiKey = m[1].trim();
    }
  }
  if (!apiKey?.startsWith("fc_")) {
    fail("No API key from /dev/provision. Re-run or set FLUXY_CONSOLE_API_KEY=fc_…");
  }

  const auth = await postJson(
    workerUrl,
    "/auth/token",
    { userId: "demo-user", roles: ["owner", "admin"], ttlSeconds: 86400 },
    { "X-Fluxy-Api-Key": apiKey },
  );
  if (!auth.token) fail("/auth/token did not return a JWT");

  const roomId = await ensureRoom(workerUrl, auth.token, provision.projectId);
  const agent = await resolveAssistantAgent(workerUrl, auth.token);

  writeEnv({
    workerUrl,
    publishableKey: provision.publishableKey || "",
    token: auth.token,
    roomId,
    agentId: agent.id,
    agentHandle: agent.handle,
    projectId: provision.projectId,
    userId: "demo-user",
    consoleUrl,
  });

  writeMeta({
    mode: "local",
    workerUrl,
    projectId: provision.projectId,
    roomId,
    agentId: agent.id,
    agentHandle: agent.handle,
    setupAt: new Date().toISOString(),
  });

  console.log(`\n${green(bold("Local setup complete."))}`);
  console.log(dim("  Run: pnpm dev"));
  console.log(dim(`  Keep this project: ${consoleUrl}/onboarding?from=cli`));
}

async function main() {
  const mode = resolveMode();
  console.log(bold(`\nFluxyChat setup (${mode})\n`));

  if (mode === "hosted") {
    await setupHosted();
  } else {
    await setupLocal();
  }
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});
