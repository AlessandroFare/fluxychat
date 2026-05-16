import { getDefaultQuotaLimit } from "./project-plan-quota.js";

/** Plan names that may be stored on project_plans (API + Stripe). */
export const ALLOWED_PLAN_NAMES = new Set(["free", "starter", "pro"]);

/**
 * Normalize untrusted planName input to a known tier (unknown → free).
 */
export function normalizePlanName(planName) {
  const base = String(planName || "free")
    .trim()
    .toLowerCase();
  if (ALLOWED_PLAN_NAMES.has(base)) return base;
  return "free";
}

/**
 * Canonical monthly limits per tier. Ignores any client-supplied numeric overrides.
 */
export function planLimitsForTier(env, planName) {
  const tier = normalizePlanName(planName);
  if (tier === "starter") {
    return {
      messageLimitMonthly: 500_000,
      agentInvokeLimitMonthly: 10_000,
      webhookDeliveryLimitMonthly: 100_000,
    };
  }
  if (tier === "pro") {
    return {
      messageLimitMonthly: 5_000_000,
      agentInvokeLimitMonthly: 100_000,
      webhookDeliveryLimitMonthly: 1_000_000,
    };
  }
  return {
    messageLimitMonthly: getDefaultQuotaLimit(env, "messages_created"),
    agentInvokeLimitMonthly: getDefaultQuotaLimit(env, "agent_invokes"),
    webhookDeliveryLimitMonthly: getDefaultQuotaLimit(env, "webhook_deliveries"),
  };
}
