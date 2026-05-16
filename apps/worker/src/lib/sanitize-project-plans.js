import { getPlatformProjectIdSet, isHostedMultiTenantMode } from "./hosted-saas-policy.js";
import { normalizePlanName, planLimitsForTier } from "./plan-tier-limits.js";

const PAID_BILLING_STATUSES = new Set(["active", "trialing", "past_due"]);

/**
 * Tier used when re-aligning a row. Unpaid tenants default to free (open-beta guard).
 */
export function resolveSanitizedTier(row, env, options = {}) {
  const demoteUnpaid = options.demoteUnpaid !== false;
  const normalized = normalizePlanName(row.plan_name);
  const platformIds = getPlatformProjectIdSet(env);

  if (platformIds.size > 0 && platformIds.has(row.project_id)) {
    return normalized;
  }

  if (!demoteUnpaid) {
    return normalized;
  }

  const hasStripeSub =
    typeof row.stripe_subscription_id === "string" &&
    row.stripe_subscription_id.trim().length > 0;
  const billingStatus = String(row.billing_status || "").toLowerCase();

  if (hasStripeSub && PAID_BILLING_STATUSES.has(billingStatus)) {
    return normalized;
  }

  if (env.SANITIZE_ALLOW_MANUAL_PAID_TIERS === "true" && normalized !== "free") {
    return normalized;
  }

  return "free";
}

function rowNeedsUpdate(row, tier, limits) {
  return (
    row.plan_name !== tier ||
    Number(row.manually_overridden) !== 0 ||
    Number(row.message_limit_monthly) !== limits.messageLimitMonthly ||
    Number(row.agent_invoke_limit_monthly) !== limits.agentInvokeLimitMonthly ||
    Number(row.webhook_delivery_limit_monthly) !== limits.webhookDeliveryLimitMonthly
  );
}

/**
 * Re-align all project_plans to canonical tier limits; clear manual overrides.
 * @returns {Promise<{ dryRun: boolean, scanned: number, updated: number, changes: object[] }>}
 */
export async function sanitizeProjectPlans(env, options = {}) {
  if (!env?.DB) {
    throw new Error("database_not_configured");
  }

  const dryRun = options.dryRun === true;
  const demoteUnpaid = options.demoteUnpaid !== false;
  const limit = Math.min(Math.max(Number(options.limit) || 10_000, 1), 50_000);

  const rows = await env.DB.prepare(
    `SELECT project_id, plan_name, billing_status, stripe_customer_id, stripe_subscription_id,
            message_limit_monthly, agent_invoke_limit_monthly, webhook_delivery_limit_monthly,
            manually_overridden, pricing_version, updated_at
     FROM project_plans
     ORDER BY project_id
     LIMIT ?`,
  )
    .bind(limit)
    .all();

  const changes = [];
  const now = new Date().toISOString();

  for (const row of rows.results || []) {
    const tier = resolveSanitizedTier(row, env, { demoteUnpaid });
    const limits = planLimitsForTier(env, tier);

    if (!rowNeedsUpdate(row, tier, limits)) {
      continue;
    }

    const change = {
      projectId: row.project_id,
      before: {
        planName: row.plan_name,
        billingStatus: row.billing_status,
        messageLimitMonthly: Number(row.message_limit_monthly),
        agentInvokeLimitMonthly: Number(row.agent_invoke_limit_monthly),
        webhookDeliveryLimitMonthly: Number(row.webhook_delivery_limit_monthly),
        manuallyOverridden: Number(row.manually_overridden) === 1,
      },
      after: {
        planName: tier,
        messageLimitMonthly: limits.messageLimitMonthly,
        agentInvokeLimitMonthly: limits.agentInvokeLimitMonthly,
        webhookDeliveryLimitMonthly: limits.webhookDeliveryLimitMonthly,
        manuallyOverridden: false,
      },
    };
    changes.push(change);

    if (!dryRun) {
      await env.DB.prepare(
        `UPDATE project_plans
         SET plan_name = ?, message_limit_monthly = ?, agent_invoke_limit_monthly = ?,
             webhook_delivery_limit_monthly = ?, manually_overridden = 0, updated_at = ?
         WHERE project_id = ?`,
      )
        .bind(
          tier,
          limits.messageLimitMonthly,
          limits.agentInvokeLimitMonthly,
          limits.webhookDeliveryLimitMonthly,
          now,
          row.project_id,
        )
        .run();

      if (tier === "free" && demoteUnpaid && row.plan_name !== tier) {
        const billingStatus = String(row.billing_status || "").toLowerCase();
        if (!row.stripe_subscription_id || !PAID_BILLING_STATUSES.has(billingStatus)) {
          await env.DB.prepare(
            `UPDATE project_plans SET billing_status = 'manual' WHERE project_id = ?`,
          )
            .bind(row.project_id)
            .run();
        }
      }
    }
  }

  return {
    dryRun,
    demoteUnpaid,
    hostedMode: isHostedMultiTenantMode(env),
    scanned: (rows.results || []).length,
    updated: changes.length,
    changes,
  };
}
