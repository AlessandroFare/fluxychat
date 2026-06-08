/**
 * Manual scheduled job triggers (P12-L ops / local dev).
 */
import { pickRouteDeps } from "./route-http-deps.js";
import {
  SCHEDULED_CRON_DIGEST,
  SCHEDULED_CRON_NOTIFICATION_BATCH,
  SCHEDULED_CRON_RETENTION,
  SCHEDULED_CRON_WEBHOOK_FLUSH,
  runScheduledCronJob,
} from "../lib/scheduled-runners.js";

const ALLOWED_CRONS = new Set([
  SCHEDULED_CRON_DIGEST,
  SCHEDULED_CRON_NOTIFICATION_BATCH,
  SCHEDULED_CRON_RETENTION,
  SCHEDULED_CRON_WEBHOOK_FLUSH,
]);

export async function dispatchScheduledAdminRoutes(request, url, h) {
  if (url.pathname !== "/admin/scheduled/run" || request.method !== "POST") {
    return null;
  }

  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
    hasAnyRole,
    writeAuditEvent,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "logError",
    "hasAnyRole",
    "writeAuditEvent",
  ]);

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }
  if (!hasAnyRole(auth.roles, ["owner", "admin"])) {
    return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
  }

  const body = await request.json().catch(() => ({}));
  const cron = typeof body?.cron === "string" ? body.cron.trim() : "";
  if (!ALLOWED_CRONS.has(cron)) {
    return json(
      {
        error: "invalid_cron",
        allowed: [...ALLOWED_CRONS],
      },
      { status: 400, headers: corsHeaders },
    );
  }

  const result = await runScheduledCronJob(env, cron);
  await writeAuditEvent(env, {
    projectId: auth.projectId,
    actorUserId: auth.userId,
    action: "scheduled.run",
    targetType: "cron",
    targetId: cron,
    metadata: { job: result.job },
  }).catch(() => {});

  return json({ ok: true, cron, ...result }, { headers: corsHeaders });
}
