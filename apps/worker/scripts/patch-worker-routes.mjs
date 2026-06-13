import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const workerPath = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "worker.js");
const lines = readFileSync(workerPath, "utf8").split("\n");
const start = lines.findIndex((l) => l.includes("const drMessagesAgents ="));
const end = lines.findIndex((l) => l.includes("if (stripeRes) return stripeRes;"));
if (start < 0 || end < 0) throw new Error(`markers not found start=${start} end=${end}`);

const insert = `    const privacyBillingDeps = {
      env,
      corsHeaders,
      json,
      requestLogCtx,
      verifyJwt: boundVerifyJwt,
      writeAuditEvent,
      hasAnyRole,
      logError,
      logInfo,
      getProjectPlan,
      monthKeyUtc,
    };

    const workerRes = await dispatchWorkerHttpRoutes(
      request,
      url,
      routeDeps,
      privacyBillingDeps,
    );
    if (workerRes) return workerRes;`;

const out = [...lines.slice(0, start), insert, ...lines.slice(end + 1)];
writeFileSync(workerPath, out.join("\n"), "utf8");
console.log(`Replaced lines ${start + 1}-${end + 1} with central route dispatcher`);
