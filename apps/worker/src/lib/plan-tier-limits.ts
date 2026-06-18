import { getDefaultQuotaLimit } from "./project-plan-quota.js";

export type PlanTierName = "free" | "starter" | "pro" | "team" | "growth";

export interface TierLimits {
  messageLimitMonthly: number;
  agentInvokeLimitMonthly: number;
  webhookDeliveryLimitMonthly: number;
}

/** Plan names that may be stored on project_plans (API + Stripe). */
export const ALLOWED_PLAN_NAMES = new Set<PlanTierName>([
  "free",
  "starter",
  "pro",
  "team",
  "growth",
]);

export const CANONICAL_TIER_LIMITS: Readonly<
  Record<"starter" | "pro" | "team" | "growth", TierLimits>
> = Object.freeze({
    starter: Object.freeze({
      messageLimitMonthly: 500_000,
      agentInvokeLimitMonthly: 10_000,
      webhookDeliveryLimitMonthly: 100_000,
    }),
    pro: Object.freeze({
      messageLimitMonthly: 5_000_000,
      agentInvokeLimitMonthly: 100_000,
      webhookDeliveryLimitMonthly: 1_000_000,
    }),
    team: Object.freeze({
      messageLimitMonthly: 20_000_000,
      agentInvokeLimitMonthly: 200_000,
      webhookDeliveryLimitMonthly: 1_000_000,
    }),
    growth: Object.freeze({
      messageLimitMonthly: 100_000_000,
      agentInvokeLimitMonthly: 1_000_000,
      webhookDeliveryLimitMonthly: 5_000_000,
    }),
  });

export const FREE_TIER_LIMITS: TierLimits = Object.freeze({
  messageLimitMonthly: 200_000,
  agentInvokeLimitMonthly: 5_000,
  webhookDeliveryLimitMonthly: 50_000,
});

export function normalizePlanName(planName: unknown): PlanTierName {
  const base = String(planName || "free")
    .trim()
    .toLowerCase();
  if (ALLOWED_PLAN_NAMES.has(base as PlanTierName)) return base as PlanTierName;
  return "free";
}

export function planLimitsForTier(env: Record<string, unknown>, planName: unknown): TierLimits {
  const tier = normalizePlanName(planName);
  if (tier === "starter" || tier === "pro" || tier === "team" || tier === "growth") {
    return { ...CANONICAL_TIER_LIMITS[tier] };
  }
  return {
    messageLimitMonthly:
      getDefaultQuotaLimit(env, "messages_created") ?? FREE_TIER_LIMITS.messageLimitMonthly,
    agentInvokeLimitMonthly:
      getDefaultQuotaLimit(env, "agent_invokes") ?? FREE_TIER_LIMITS.agentInvokeLimitMonthly,
    webhookDeliveryLimitMonthly:
      getDefaultQuotaLimit(env, "webhook_deliveries") ??
      FREE_TIER_LIMITS.webhookDeliveryLimitMonthly,
  };
}
