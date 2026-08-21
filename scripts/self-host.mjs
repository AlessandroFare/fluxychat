#!/usr/bin/env node
/**
 * One-command local self-host bootstrap:
 * install deps, dev env files, D1 migrations (local), optional Groq key.
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const WORKER = path.join(ROOT, "apps/worker");
const DEV_VARS = path.join(WORKER, ".dev.vars");

function run(cmd, args, cwd = ROOT) {
  console.log(`\n> ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function promptLine(question) {
  if (!process.stdin.isTTY) return Promise.resolve("");
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`${question}: `, (answer) => {
      rl.close();
      resolve(String(answer || "").trim());
    });
  });
}

function upsertDevVars(updates) {
  if (!fs.existsSync(DEV_VARS)) return;
  let text = fs.readFileSync(DEV_VARS, "utf8");
  for (const [key, value] of Object.entries(updates)) {
    if (!value) continue;
    const re = new RegExp(`^#?\\s*${key}\\s*=.*$`, "m");
    const line = `${key}=${value}`;
    if (re.test(text)) text = text.replace(re, line);
    else text += `\n${line}\n`;
  }
  fs.writeFileSync(DEV_VARS, text);
}

function readDevVar(key) {
  if (!fs.existsSync(DEV_VARS)) return "";
  const text = fs.readFileSync(DEV_VARS, "utf8");
  const m = text.match(new RegExp(`^${key}\\s*=\\s*(.*)$`, "m"));
  return m?.[1]?.trim() ?? "";
}

async function fillInteractiveSecrets() {
  if (!fs.existsSync(DEV_VARS)) return;
  if (!readDevVar("API_KEY_HASH_SALT")) {
    upsertDevVars({ API_KEY_HASH_SALT: randomBytes(32).toString("base64") });
    console.log("wrote API_KEY_HASH_SALT in apps/worker/.dev.vars");
  }
  if (readDevVar("GROQ_API_KEY")) return;
  const groq = await promptLine("Groq API key for @assistant (optional, Enter to skip)");
  if (!groq) return;
  upsertDevVars({
    GROQ_API_KEY: groq,
    AI_MODEL: "openai/gpt-oss-20b",
  });
  console.log("wrote GROQ_API_KEY and AI_MODEL=openai/gpt-oss-20b");
}

console.log("FluxyChat self-host bootstrap\n");

if (!fs.existsSync(path.join(ROOT, "node_modules"))) {
  run("pnpm", ["install"]);
}

run("pnpm", ["run", "dev:setup"]);
await fillInteractiveSecrets();

const wrangler = path.join(WORKER, "node_modules", ".bin", process.platform === "win32" ? "wrangler.cmd" : "wrangler");
if (fs.existsSync(wrangler)) {
  run(wrangler, ["d1", "migrations", "apply", "fluxychat", "--local"], WORKER);
} else {
  run("pnpm", ["exec", "wrangler", "d1", "migrations", "apply", "fluxychat", "--local"], WORKER);
}

console.log(`
Done. Next steps:

  1. Worker:  pnpm --filter @fluxy-chat/worker dev
  2. Dashboard (optional): pnpm --filter dashboard dev
  3. First message smoke: pnpm run first-message
  4. App: npx @fluxy-chat/create-fluxy-chat@latest my-app --mode self-host

Docs: apps/docs/content/docs/guides/self-host-one-command.mdx
`);
