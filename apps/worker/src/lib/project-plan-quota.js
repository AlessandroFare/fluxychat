export function monthKeyUtc(date = new Date()) {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

const DEFAULT_QUOTA_METRICS = {
  messages_created: "messageLimitMonthly",
  agent_invokes: "agentInvokeLimitMonthly",
  webhook_deliveries: "webhookDeliveryLimitMonthly",
};

export function getDefaultQuotaLimit(env, metricName) {
  const defaults = {
    messages_created: Number(env.QUOTA_MESSAGES_PER_MONTH || 50_000),
    agent_invokes: Number(env.QUOTA_AGENT_INVOKES_PER_MONTH || 1_000),
    webhook_deliveries: Number(env.QUOTA_WEBHOOK_DELIVERIES_PER_MONTH || 10_000),
  };
  const val = defaults[metricName];
  return Number.isFinite(val) && val > 0 ? val : null;
}

export async function getProjectPlan(env, projectId) {
  if (!env?.DB || !projectId) return null;
  const row = await env.DB.prepare(
    "SELECT project_id, plan_name, billing_status, stripe_customer_id, stripe_subscription_id, message_limit_monthly, agent_invoke_limit_monthly, webhook_delivery_limit_monthly, pricing_version, manually_overridden, created_at, updated_at FROM project_plans WHERE project_id = ? LIMIT 1"
  )
    .bind(projectId)
    .first();
  if (!row) return null;
  return {
    projectId: row.project_id,
    planName: row.plan_name,
    billingStatus: row.billing_status,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    messageLimitMonthly: row.message_limit_monthly,
    agentInvokeLimitMonthly: row.agent_invoke_limit_monthly,
    webhookDeliveryLimitMonthly: row.webhook_delivery_limit_monthly,
    manuallyOverridden: !!row.manually_overridden,
    pricingVersion: row.pricing_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getProjectQuotaLimit(env, projectId, metricName) {
  const enabled = String(env.QUOTAS_ENABLED || "true") !== "false";
  if (!enabled) return null;
  const plan = await getProjectPlan(env, projectId);
  const field = DEFAULT_QUOTA_METRICS[metricName];
  const planLimit = field ? Number(plan?.[field]) : NaN;
  if (Number.isFinite(planLimit) && planLimit > 0) {
    return planLimit;
  }
  return getDefaultQuotaLimit(env, metricName);
}

export async function checkAndConsumeProjectQuota(env, options) {
  if (!env?.DB) return { allowed: true, metricName: options.metricName };
  const limit = await getProjectQuotaLimit(env, options.projectId, options.metricName);
  if (!limit) return { allowed: true, metricName: options.metricName };

  const monthKey = monthKeyUtc();
  const id = `${options.projectId}|${monthKey}|${options.metricName}`;
  const now = new Date().toISOString();
  const amount = Number(options.amount || 1);

  await env.DB.prepare(
    "INSERT OR IGNORE INTO project_usage_monthly (id, project_id, month_key, metric_name, used_value, updated_at) VALUES (?, ?, ?, ?, 0, ?)"
  )
    .bind(id, options.projectId, monthKey, options.metricName, now)
    .run();

  const result = await env.DB.prepare(
    "UPDATE project_usage_monthly SET used_value = used_value + ?, updated_at = ? WHERE id = ? AND used_value + ? <= ?"
  )
    .bind(amount, now, id, amount, limit)
    .run();

  if (!result.meta.changes) {
    const row = await env.DB.prepare(
      "SELECT used_value FROM project_usage_monthly WHERE id = ?"
    )
      .bind(id)
      .first();
    return {
      allowed: false,
      metricName: options.metricName,
      limit,
      used: Number(row?.used_value || 0),
      monthKey,
    };
  }

  return { allowed: true, metricName: options.metricName, limit, used: limit, monthKey };
}
