/**
 * Shared scheduled task runners (P12-L).
 * Invoked from Workflow schedules and legacy Worker `scheduled` handler.
 */
import { logInfo } from "./worker-log.js";
import { runDailyDigest } from "./daily-digest.js";
import { flushDueNotificationBatches } from "./notification-batch.js";
import { processPendingWebhookDeliveries } from "./webhook-delivery.js";

export const SCHEDULED_CRON_DIGEST = "0 8 * * *";
export const SCHEDULED_CRON_NOTIFICATION_BATCH = "*/15 * * * *";
export const SCHEDULED_CRON_RETENTION = "0 3 * * *";
export const SCHEDULED_CRON_WEBHOOK_FLUSH = "*/5 * * * *";

/**
 * @param {*} env
 */
export async function purgeExpiredData(env) {
  if (!env?.DB) return;
  const now = new Date();
  const nowIso = now.toISOString();

  const policies = await env.DB.prepare(
    "SELECT project_id, data_type, retention_days, auto_purge FROM data_retention_policies WHERE auto_purge = 1",
  ).all();

  for (const policy of policies.results || []) {
    const cutoff = new Date(now.getTime() - policy.retention_days * 86400000).toISOString();

    if (policy.data_type === "messages") {
      const result = await env.DB.prepare(
        "DELETE FROM messages WHERE project_id = ? AND created_at < ? AND deleted_at IS NOT NULL",
      )
        .bind(policy.project_id, cutoff)
        .run();
      logInfo("retention.purge.messages", {
        projectId: policy.project_id,
        cutoff,
        changes: result.meta?.changes || 0,
      });
    }

    if (policy.data_type === "audit_events") {
      const result = await env.DB.prepare(
        "DELETE FROM operational_audit_events WHERE project_id = ? AND created_at < ?",
      )
        .bind(policy.project_id, cutoff)
        .run();
      logInfo("retention.purge.audit_events", {
        projectId: policy.project_id,
        cutoff,
        changes: result.meta?.changes || 0,
      });
    }

    if (policy.data_type === "agent_runs") {
      const result = await env.DB.prepare(
        "DELETE FROM agent_runs WHERE project_id = ? AND created_at < ?",
      )
        .bind(policy.project_id, cutoff)
        .run();
      logInfo("retention.purge.agent_runs", {
        projectId: policy.project_id,
        cutoff,
        changes: result.meta?.changes || 0,
      });
    }

    if (policy.data_type === "usage_monthly") {
      const result = await env.DB.prepare(
        "DELETE FROM project_usage_monthly WHERE project_id = ? AND month_key < ?",
      )
        .bind(policy.project_id, cutoff.slice(0, 7))
        .run();
      logInfo("retention.purge.usage_monthly", {
        projectId: policy.project_id,
        cutoff: cutoff.slice(0, 7),
        changes: result.meta?.changes || 0,
      });
    }

    if (policy.data_type === "webhook_deliveries") {
      const result = await env.DB.prepare(
        "DELETE FROM webhook_delivery_queue WHERE project_id = ? AND created_at < ?",
      )
        .bind(policy.project_id, cutoff)
        .run();
      logInfo("retention.purge.webhook_deliveries", {
        projectId: policy.project_id,
        cutoff,
        changes: result.meta?.changes || 0,
      });
    }

    await env.DB.prepare(
      "UPDATE data_retention_policies SET last_purged_at = ? WHERE project_id = ? AND data_type = ?",
    )
      .bind(nowIso, policy.project_id, policy.data_type)
      .run();
  }

  logInfo("retention.purge.completed", { at: nowIso });
}

/**
 * @param {*} env
 * @param {string} cron
 */
export async function runScheduledCronJob(env, cron) {
  const normalized = String(cron || "").trim();
  switch (normalized) {
    case SCHEDULED_CRON_DIGEST:
      await runDailyDigest(env);
      return { job: "daily_digest" };
    case SCHEDULED_CRON_NOTIFICATION_BATCH:
      await flushDueNotificationBatches(env);
      return { job: "notification_batch" };
    case SCHEDULED_CRON_RETENTION:
      await purgeExpiredData(env);
      return { job: "retention_purge" };
    case SCHEDULED_CRON_WEBHOOK_FLUSH:
      await processPendingWebhookDeliveries(env);
      return { job: "webhook_flush" };
    default:
      if (!normalized) {
        await purgeExpiredData(env);
        return { job: "retention_purge_legacy" };
      }
      return { job: "unknown", cron: normalized };
  }
}
