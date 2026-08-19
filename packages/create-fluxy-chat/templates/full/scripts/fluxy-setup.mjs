#!/usr/bin/env node
/**
 * Provision credentials and write .env for the full template.
 *
 * Modes:
 *   local  (default) — POST /dev/provision on local worker (ALLOW_DEV_PROVISION=true)
 *   hosted           — GET /demo/session on fluxychat.com (no wrangler required)
 *
 * Usage:
 *   pnpm setup
 *   pnpm setup -- --mode hosted
 *   FLUXY_SETUP_MODE=hosted pnpm setup
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");
const metaPath = join(root, ".fluxy", "setup.json");
const modePath = join(root, ".fluxy", "mode");

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

function readDefaultMode() {
  if (existsSync(modePath)) {
    const m = readFileSync(modePath, "utf8").trim().toLowerCase();
    if (m === "hosted" || m === "local") return m;
  }
  return "local";
}

function resolveMode() {
  const argv = process.argv.slice(2);
  const flagIdx = argv.indexOf("--mode");
  if (flagIdx >= 0 && argv[flagIdx + 1]) {
    const m = String(argv[flagIdx + 1]).trim().toLowerCase();
    if (m === "hosted" || m === "local") return m;
    fail(`Unknown mode "${argv[flagIdx + 1]}". Use: local | hosted`);
  }
  const fromEnv = String(process.env.FLUXY_SETUP_MODE || "").trim().toLowerCase();
  if (fromEnv === "hosted" || fromEnv === "local") return fromEnv;
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

  console.log(dim(`  mode: hosted · worker: ${workerUrl}`));

  writeEnv({
    workerUrl,
    token: "",
    roomId: "",
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
    roomId: null,
    agentId: null,
    agentHandle: "@assistant",
    setupAt: new Date().toISOString(),
    auth: "clerk",
  });

  ok("wrote hosted endpoints (sign in with Clerk on pnpm dev)");
  console.log(dim("  Run: pnpm dev"));
  console.log(dim("  Sign in with Clerk. We create your project and assistant room."));
  console.log(dim(`  Console: ${consoleUrl}/onboarding`));
}

async function setupLocal() {
  const workerUrl =
    process.env.FLUXY_WORKER_URL || process.env.FLUXYCHAT_WORKER_URL || LOCAL_WORKER_DEFAULT;
  const consoleUrl = process.env.FLUXY_CONSOLE_URL || LOCAL_CONSOLE_DEFAULT;

  console.log(dim(`  mode: local · worker: ${workerUrl}`));

  if (!(await isWorkerUp(workerUrl))) {
    fail(
      `Worker not reachable at ${workerUrl}\n` +
        "  Start it from the FluxyChat monorepo:\n" +
        "    pnpm --filter @fluxy-chat/worker dev\n" +
        "  Or use hosted mode:\n" +
        "    pnpm setup -- --mode hosted",
    );
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
