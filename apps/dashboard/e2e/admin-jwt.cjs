"use strict";

const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { dirname, join } = require("node:path");

const jwtFile = join(process.cwd(), "e2e", ".auth", "admin.jwt");
const sessionFile = join(process.cwd(), "e2e", ".auth", "session.json");

function readAdminJwt() {
  const fromEnv = process.env.E2E_ADMIN_JWT?.trim();
  if (fromEnv) return fromEnv;
  if (!existsSync(jwtFile)) return "";
  return readFileSync(jwtFile, "utf8").trim();
}

function readEnvValueFromFile(filePath, key) {
  if (!existsSync(filePath)) return null;
  const content = readFileSync(filePath, "utf8");
  const m = content.match(new RegExp(`^${key}\\s*=\\s*(.+)$`, "m"));
  if (!m) return null;
  const raw = m[1].trim().replace(/^["']|["']$/g, "");
  return raw || null;
}

function envFiles() {
  return [
    join(process.cwd(), "..", "worker", ".dev.vars"),
    join(process.cwd(), ".env.local"),
    join(process.cwd(), "..", "..", "scripts", ".provision-secrets.env"),
  ];
}

function resolveFromFiles(keyNames) {
  for (const key of keyNames) {
    const fromEnv = process.env[key]?.trim();
    if (fromEnv) return fromEnv;
  }
  for (const file of envFiles()) {
    for (const key of keyNames) {
      const value = readEnvValueFromFile(file, key);
      if (value) return value;
    }
  }
  return null;
}

function resolveConsoleApiKey() {
  for (const value of [
    process.env.FLUXY_CONSOLE_API_KEY,
    process.env.FIRST_MESSAGE_API_KEY,
    process.env.DEMO_API_KEY,
  ]) {
    if (value?.startsWith("fc_")) return value;
  }
  for (const file of envFiles()) {
    for (const key of ["FLUXY_CONSOLE_API_KEY", "DEMO_API_KEY", "FIRST_MESSAGE_API_KEY"]) {
      const value = readEnvValueFromFile(file, key);
      if (value?.startsWith("fc_")) return value;
    }
  }
  return null;
}

function resolveConfiguredProjectId() {
  return resolveFromFiles([
    "FLUXY_CONSOLE_PROJECT_ID",
    "FLUXY_PLATFORM_PROJECT_ID",
    "NEXT_PUBLIC_FLUXY_PLATFORM_PROJECT_ID",
  ]);
}

function decodeJwtPayload(token) {
  try {
    const part = String(token).split(".")[1];
    if (!part) return null;
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function writeSession({ token, projectId, projectName }) {
  mkdirSync(dirname(jwtFile), { recursive: true });
  writeFileSync(jwtFile, `${token.trim()}\n`, { encoding: "utf8", mode: 0o600 });
  writeFileSync(
    sessionFile,
    `${JSON.stringify({ projectId: projectId || null, projectName: projectName || projectId || "e2e" }, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  process.env.E2E_ADMIN_JWT = token.trim();
  if (projectId) process.env.FLUXY_CONSOLE_PROJECT_ID = projectId;
}

async function roomsOk(workerUrl, token) {
  const res = await fetch(`${workerUrl}/rooms`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null);
  return Boolean(res && res.ok);
}

async function postJson(workerUrl, path, body, headers = {}) {
  const res = await fetch(`${workerUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

/**
 * Mint a Worker-verified admin JWT. Do not invent tid=dev-local: without
 * FLUXY_CONSOLE_PROJECT_ID / a D1 project_secrets row the Worker returns 401.
 */
async function ensureAdminJwt(workerUrl) {
  const health = await fetch(`${workerUrl}/health`).catch(() => null);
  if (!health || !health.ok) {
    throw new Error(
      `Worker not reachable at ${workerUrl}/health. Start: pnpm --filter @fluxy-chat/worker dev`,
    );
  }

  const existing = readAdminJwt();
  if (existing && (await roomsOk(workerUrl, existing))) {
    const claims = decodeJwtPayload(existing) || {};
    const projectId = claims.tid || resolveConfiguredProjectId();
    writeSession({ token: existing, projectId, projectName: projectId });
    return existing;
  }

  const provisionRes = await fetch(`${workerUrl}/dev/provision`, { method: "POST" });
  const provisionJson = await provisionRes.json().catch(() => ({}));
  const provisionedKey =
    typeof provisionJson.apiKey === "string" && provisionJson.apiKey.startsWith("fc_")
      ? provisionJson.apiKey
      : null;
  const apiKey = provisionedKey || resolveConsoleApiKey();
  const provisionedProjectId =
    typeof provisionJson.projectId === "string" ? provisionJson.projectId : resolveConfiguredProjectId();

  if (!apiKey) {
    throw new Error(
      [
        "Cannot mint E2E_ADMIN_JWT: no fc_ key and local Fluxy project id is unset.",
        "POST /dev/provision either returned reused:true (plaintext key not re-emitted)",
        "or 404 (set ALLOW_DEV_PROVISION=true and NODE_ENV=development on wrangler).",
        "Fix: pnpm run first-message, or copy FLUXY_CONSOLE_API_KEY + FLUXY_CONSOLE_PROJECT_ID",
        "into apps/worker/.dev.vars and apps/dashboard/.env.local.",
      ].join(" "),
    );
  }

  const minted = await postJson(
    workerUrl,
    "/auth/token",
    { userId: "e2e-admin", roles: ["admin"], ttlSeconds: 3600 },
    { "X-Fluxy-Api-Key": apiKey },
  );
  const token = typeof minted.json.token === "string" ? minted.json.token : "";
  if (!minted.ok || !token) {
    throw new Error(
      [
        `/auth/token failed (${minted.status} ${minted.json.error || minted.json.message || "unknown"}).`,
        "The fc_ key must belong to a row in local D1; FLUXY_CONSOLE_PROJECT_ID is optional",
        "because tid comes from the key. Re-run first-message if the key never matched this Worker.",
      ].join(" "),
    );
  }

  const claims = decodeJwtPayload(token) || {};
  const projectId = claims.tid || provisionedProjectId;
  if (!(await roomsOk(workerUrl, token))) {
    throw new Error(
      `Minted JWT was rejected by GET /rooms (tid=${projectId || "missing"}). Worker D1 has no jwt_secret for that project.`,
    );
  }

  writeSession({
    token,
    projectId,
    projectName: typeof provisionJson.projectName === "string" ? provisionJson.projectName : projectId,
  });
  return token;
}

module.exports = { ensureAdminJwt, jwtFile, sessionFile };
