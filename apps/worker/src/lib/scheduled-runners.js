/**
 * Shared scheduled task runners (P12-L).
 * Invoked from Workflow schedules and legacy Worker `scheduled` handler.
 */
import { logInfo } from "./worker-log.js";
import { runDailyDigest } from "./daily-digest.js";
import { flushDueNotificationBatches } from "./notification-batch.js";
import { processPendingWebhookDeliveries } from "./webhook-delivery.js";
import { syncModelsCatalog } from "./llm-models-catalog.js";
import { purgeAllConfiguredRoomRetention } from "./message-retention-room.js";
import { exportAllProjectAuditChainsToR2 } from "./audit-chain.js";
import { expirePendingDecisions } from "./message-decisions.js";
import { purgeExpiredWebAuthnChallenges } from "./webauthn-passkeys.js";
import { expireRehearsalRooms } from "./rehearsal-rooms.js";

export const SCHEDULED_CRON_DIGEST = "0 8 * * *";
export const SCHEDULED_CRON_NOTIFICATION_BATCH = "*/15 * * * *";
export const SCHEDULED_CRON_RETENTION = "0 3 * * *";
export const SCHEDULED_CRON_WEBHOOK_FLUSH = "*/5 * * * *";
export const SCHEDULED_CRON_MODELS_SYNC = "0 */6 * * *";

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

  const roomTtl = await purgeAllConfiguredRoomRetention(env).catch(() => ({ purged: 0, rooms: 0 }));
  logInfo("retention.purge.room_ttl", roomTtl);

  const auditExport = await exportAllProjectAuditChainsToR2(env).catch(() => ({
    ok: false,
    exported: 0,
  }));
  logInfo("audit_chain.r2_export", auditExport);

  const matrixHealth = await import("./matrix-bridge.js")
    .then((m) => m.runMatrixBridgeHealthChecks(env))
    .catch(() => ({ checked: 0, healthy: 0, unhealthy: 0 }));
  logInfo("matrix.health_check", matrixHealth);

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
      await expirePendingDecisions(env).catch(() => ({ expired: 0 }));
      await purgeExpiredWebAuthnChallenges(env).catch(() => {});
      await expireRehearsalRooms(env).catch(() => ({ expired: 0 }));
      const { resumeStuckDurableWorkflows } = await import("./agent-durable-workflow.js");
      await resumeStuckDurableWorkflows(env, { limit: 5 }).catch(() => ({ resumed: 0 }));
      const { expireOpenTruthClaims } = await import("./truth-market.js");
      await expireOpenTruthClaims(env).catch(() => ({ expired: 0 }));
      const { expireStaleCrossOrgCommitments } = await import("./cross-org-rooms.js");
      await expireStaleCrossOrgCommitments(env).catch(() => ({ expired: 0 }));
      return { job: "notification_batch" };
    case SCHEDULED_CRON_RETENTION:
      await purgeExpiredData(env);
      return { job: "retention_purge" };
    case SCHEDULED_CRON_WEBHOOK_FLUSH:
      await processPendingWebhookDeliveries(env);
      const { tickPresenceEscalations } = await import("./presence-escalation.js");
      await tickPresenceEscalations(env).catch(() => ({ processed: 0 }));
      const { tickHitlApprovalEscalations } = await import("./hitl-approval-tick.js");
      await tickHitlApprovalEscalations(env).catch(() => ({ processed: 0 }));
      const { runEscalationScan } = await import("./escalation-rules.js");
      await runEscalationScan(env).catch(() => ({ scanned: 0, escalated: 0 }));
      return { job: "webhook_flush" };
    case SCHEDULED_CRON_MODELS_SYNC:
      await syncModelsCatalog(env);
      return { job: "models_sync" };
    default:
      if (!normalized) {
        await purgeExpiredData(env);
        return { job: "retention_purge_legacy" };
      }
      return { job: "unknown", cron: normalized };
  }
}
