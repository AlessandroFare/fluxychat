/**
 * #61 Tenant usage / cost aggregates for operator transparency.
 */
import { monthKeyUtc, getProjectPlan } from "./project-plan-quota.js";

const DEFAULT_COST_RATES = {
  perThousandMessagesUsd: 0.02,
  perAgentInvokeUsd: 0.005,
  perGbStorageMonthUsd: 0.15,
  platformBaseUsd: 0,
};

/**
 * @param {*} env
 * @param {string} projectId
 */
export async function getTenantUsageSnapshot(env, projectId) {
  const monthKey = monthKeyUtc();
  const monthStart = `${monthKey}-01T00:00:00.000Z`;

  const usageRows = await env.DB.prepare(
    `SELECT metric_name, used_value FROM project_usage_monthly
     WHERE project_id = ? AND month_key = ?`,
  )
    .bind(projectId, monthKey)
    .all();

  /** @type {Record<string, number>} */
  const monthlyUsage = {};
  for (const row of usageRows.results || []) {
    monthlyUsage[row.metric_name] = Number(row.used_value || 0);
  }

  const mauRow = await env.DB.prepare(
    `SELECT COUNT(DISTINCT user_id) AS mau
     FROM messages
     WHERE project_id = ? AND created_at >= ? AND deleted_at IS NULL`,
  )
    .bind(projectId, monthStart)
    .first();

  const storageRow = await env.DB.prepare(
    `SELECT COALESCE(SUM(size_bytes), 0) AS bytes, COUNT(*) AS files
     FROM attachments
     WHERE project_id = ?`,
  )
    .bind(projectId)
    .first();

  const roomCountRow = await env.DB.prepare(
    `SELECT COUNT(*) AS rooms FROM rooms WHERE project_id = ?`,
  )
    .bind(projectId)
    .first();

  const messageCountRow = await env.DB.prepare(
    `SELECT COUNT(*) AS total FROM messages WHERE project_id = ? AND deleted_at IS NULL`,
  )
    .bind(projectId)
    .first();

  const fromBucket = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString().slice(0, 16);
  const opsRows = await env.DB.prepare(
    `SELECT metric_name, COALESCE(SUM(metric_value), 0) AS total
     FROM operational_metrics
     WHERE project_id = ? AND bucket_minute >= ?
     GROUP BY metric_name`,
  )
    .bind(projectId, fromBucket)
    .all();

  /** @type {Record<string, number>} */
  const opsLast30d = {};
  for (const row of opsRows.results || []) {
    opsLast30d[row.metric_name] = Number(row.total || 0);
  }

  const plan = await getProjectPlan(env, projectId);
  const storageBytes = Number(storageRow?.bytes || 0);
  const storageGb = storageBytes / (1024 ** 3);

  const rates = readCostRates(env);
  const estimatedCostUsd = estimateMonthlyCostUsd({
    rates,
    messagesCreated: monthlyUsage.messages_created || 0,
    agentInvokes: monthlyUsage.agent_invokes || 0,
    storageGb,
  });

  return {
    projectId,
    monthKey,
    plan: plan
      ? {
          planName: plan.planName,
          billingStatus: plan.billingStatus,
          messageLimitMonthly: plan.messageLimitMonthly,
          agentInvokeLimitMonthly: plan.agentInvokeLimitMonthly,
          webhookDeliveryLimitMonthly: plan.webhookDeliveryLimitMonthly,
        }
      : null,
    monthlyUsage: {
      messagesCreated: monthlyUsage.messages_created || 0,
      agentInvokes: monthlyUsage.agent_invokes || 0,
      webhookDeliveries: monthlyUsage.webhook_deliveries || 0,
    },
    totals: {
      messagesAllTime: Number(messageCountRow?.total || 0),
      rooms: Number(roomCountRow?.rooms || 0),
      mau: Number(mauRow?.mau || 0),
      attachmentFiles: Number(storageRow?.files || 0),
      storageBytes,
      storageGb: Math.round(storageGb * 1000) / 1000,
    },
    opsLast30d,
    costEstimate: {
      currency: "USD",
      monthKey,
      estimatedUsd: Math.round(estimatedCostUsd * 100) / 100,
      rates,
      disclaimer:
        "Indicative estimate from configured unit rates — not an invoice. See /billing for plan quotas.",
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * @param {*} env
 */
function readCostRates(env) {
  return {
    perThousandMessagesUsd: Number(env.USAGE_COST_PER_1K_MESSAGES_USD ?? DEFAULT_COST_RATES.perThousandMessagesUsd),
    perAgentInvokeUsd: Number(env.USAGE_COST_PER_AGENT_INVOKE_USD ?? DEFAULT_COST_RATES.perAgentInvokeUsd),
    perGbStorageMonthUsd: Number(env.USAGE_COST_PER_GB_STORAGE_USD ?? DEFAULT_COST_RATES.perGbStorageMonthUsd),
    platformBaseUsd: Number(env.USAGE_COST_PLATFORM_BASE_USD ?? DEFAULT_COST_RATES.platformBaseUsd),
  };
}

/**
 * @param {{
 *   rates: ReturnType<typeof readCostRates>,
 *   messagesCreated: number,
 *   agentInvokes: number,
 *   storageGb: number,
 * }} input
 */
function estimateMonthlyCostUsd(input) {
  const { rates, messagesCreated, agentInvokes, storageGb } = input;
  const messageCost = (messagesCreated / 1000) * rates.perThousandMessagesUsd;
  const agentCost = agentInvokes * rates.perAgentInvokeUsd;
  const storageCost = storageGb * rates.perGbStorageMonthUsd;
  return rates.platformBaseUsd + messageCost + agentCost + storageCost;
}
