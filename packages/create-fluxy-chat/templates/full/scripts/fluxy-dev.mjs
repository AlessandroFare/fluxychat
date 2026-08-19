#!/usr/bin/env node
/**
 * Start Vite app; optionally worker + dashboard from detected monorepo.
 * Auto-runs setup when .env is missing and worker is reachable.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");
const modePath = join(root, ".fluxy", "mode");
const WORKER_URL = process.env.FLUXY_WORKER_URL || "http://127.0.0.1:8787";
const POLL_MS = 500;
const POLL_MAX = 90_000;
const START_DASHBOARD = process.env.FLUXY_START_DASHBOARD !== "0";

function findMonorepo(startDir) {
  const explicit = process.env.FLUXYCHAT_ROOT?.trim();
  if (explicit && existsSync(join(explicit, "apps", "worker", "package.json"))) {
    return explicit;
  }
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    const workerPkg = join(dir, "apps", "worker", "package.json");
    if (existsSync(workerPkg)) {
      try {
        const pkg = JSON.parse(readFileSync(workerPkg, "utf8"));
        if (pkg.name === "@fluxy-chat/worker") return dir;
      } catch {
        /* ignore */
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function readSetupMode() {
  if (existsSync(modePath)) {
    const m = readFileSync(modePath, "utf8").trim().toLowerCase();
    if (m === "hosted" || m === "local") return m;
  }
  return "local";
}

async function isWorkerUp(url = WORKER_URL) {
  try {
    const r = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function runProc(label, cmd, args, cwd, env = {}) {
  const child = spawn(cmd, args, {
    cwd,
    shell: process.platform === "win32",
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[${label}] exited with code ${code}`);
    }
  });
  return child;
}

function runSetup(mode) {
  const args = ["scripts/fluxy-setup.mjs"];
  if (mode === "hosted") args.push("--mode", "hosted");
  const result = spawnSync("node", args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  return result.status === 0;
}

async function main() {
  const monorepo = findMonorepo(root);
  const children = [];
  const setupMode = readSetupMode();

  if (!existsSync(envPath)) {
    if (setupMode === "hosted") {
      console.log("No .env — running hosted setup…");
      if (!runSetup("hosted")) {
        console.warn("Hosted setup failed. Fix network or run: pnpm setup -- --mode hosted");
      }
    } else if (await isWorkerUp()) {
      console.log("No .env — running local setup…");
      if (!runSetup("local")) {
        console.warn("Setup failed. Run: pnpm setup");
      }
    } else if (monorepo) {
      console.log("No .env — will start worker then run setup…");
    } else {
      console.warn(
        "No .env found.\n" +
          "  Hosted:  pnpm setup -- --mode hosted\n" +
          "  Local:   start worker, then pnpm setup",
      );
    }
  }

  if (!(await isWorkerUp()) && setupMode === "local" && monorepo) {
    console.log(`Starting worker from monorepo: ${monorepo}`);
    children.push(
      runProc("worker", "pnpm", ["--filter", "@fluxy-chat/worker", "dev"], monorepo, {
        ALLOW_DEV_PROVISION: "true",
        NODE_ENV: "development",
      }),
    );
    const start = Date.now();
    while (Date.now() - start < POLL_MAX) {
      if (await isWorkerUp()) {
        console.log(`Worker ready at ${WORKER_URL}`);
        break;
      }
      await sleep(POLL_MS);
    }
    if (!existsSync(envPath) && (await isWorkerUp())) {
      console.log("Running setup after worker start…");
      runSetup("local");
    }
  } else if (await isWorkerUp()) {
    console.log(`Worker reachable at ${WORKER_URL}`);
  }

  if (START_DASHBOARD && monorepo && setupMode === "local") {
    console.log("Starting dashboard console on :3000");
    children.push(
      runProc("dashboard", "pnpm", ["--filter", "@fluxy-chat/dashboard", "dev"], monorepo),
    );
  }

  children.push(runProc("vite", "pnpm", ["run", "dev:app"], root));

  function shutdown() {
    for (const child of children) {
      if (child && !child.killed) {
        try {
          child.kill("SIGTERM");
        } catch {
          /* ignore */
        }
      }
    }
    process.exit(0);
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
