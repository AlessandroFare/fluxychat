/**
 * Public plan labels and display limits (billing UI, future marketing).
 * Runtime enforcement reads limits from D1 `project_plans`; keep numbers aligned when changing tiers.
 *
 * The numbers in `CANONICAL_TIER_LIMITS` are the SINGLE source of truth, mirrored from
 * `apps/worker/src/lib/plan-tier-limits.ts`. A CI cross-check
 * (`scripts/check-pricing-consistency.mjs`) fails the build if the two modules drift.
 */
export interface CanonicalTierLimits {
  messageLimitMonthly: number;
  agentInvokeLimitMonthly: number;
  webhookDeliveryLimitMonthly: number;
}

/**
 * Canonical monthly limits per self-serve tier. Mirrored from
 * `apps/worker/src/lib/plan-tier-limits.js` so the worker and the dashboard
 * agree on what each plan means.
 *
 * `free` is intentionally absent; the free tier uses environment defaults
 * (see `planLimitsForTier` in the worker module).
 */
export const CANONICAL_TIER_LIMITS: Readonly<Record<"starter" | "pro", CanonicalTierLimits>> =
  Object.freeze({
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
  });

/** Default free-tier limits. Mirrors the worker's `getDefaultQuotaLimit` defaults
 *  (50k messages, 1k agent invokes, 10k webhook deliveries). Kept here so the
 *  dashboard renders a faithful preview when no env is available. */
export const FREE_TIER_LIMITS: CanonicalTierLimits = Object.freeze({
  messageLimitMonthly: 50_000,
  agentInvokeLimitMonthly: 1_000,
  webhookDeliveryLimitMonthly: 10_000,
});

export interface PublicPlanRow {
  label: string;
  price: string;
  messages: number;
  agents: number;
  webhooks: number;
  /** Short line for marketing / pricing cards */
  tagline: string;
  /** Extra bullets shown on the public landing */
  bullets: string[];
}

/** Sales-led tiers — display on landing; billing enforcement stays on free/starter/pro until migrated. */
export interface SalesPlanRow {
  label: string;
  price: string;
  tagline: string;
  bullets: string[];
  cta: string;
  href: string;
}

export const SALES_PLAN_CATALOG: SalesPlanRow[] = [
  {
    label: "Growth",
    price: "From $199/mo",
    tagline: "Small B2B SaaS with omnichannel and analytics.",
    bullets: [
      "Multiple projects",
      "Omnichannel inbox (base)",
      "AI memory and FTS search",
      "Light moderation tooling",
    ],
    cta: "Contact sales",
    href: "mailto:fluxychat@outlook.com?subject=FluxyChat%20Growth",
  },
  {
    label: "Business",
    price: "From $699/mo",
    tagline: "Serious teams needing SSO and audit at scale.",
    bullets: [
      "SSO add-on",
      "Custom domain and higher limits",
      "Audit export schedules",
      "Priority support, white-label lite",
    ],
    cta: "Contact sales",
    href: "mailto:fluxychat@outlook.com?subject=FluxyChat%20Business",
  },
  {
    label: "Enterprise",
    price: "Custom",
    tagline: "Regulated and large deployments.",
    bullets: [
      "SCIM and SLA",
      "Retention and DLP pack",
      "Compliance review",
      "Dedicated support",
    ],
    cta: "Talk to us",
    href: "mailto:fluxychat@outlook.com?subject=FluxyChat%20Enterprise",
  },
];

export const PUBLIC_PLAN_CATALOG: Record<string, PublicPlanRow> = {
  free: {
    label: "Free",
    price: "$0/mo",
    messages: FREE_TIER_LIMITS.messageLimitMonthly,
    agents: FREE_TIER_LIMITS.agentInvokeLimitMonthly,
    webhooks: FREE_TIER_LIMITS.webhookDeliveryLimitMonthly,
    tagline: "Try the stack without a card.",
    bullets: [
      "SDK and dashboard access",
      "Help via GitHub issues",
      "One project, fair-use limits",
      "Upgrade without migrating data",
    ],
  },
  starter: {
    label: "Starter",
    price: "$19.99/mo",
    messages: CANONICAL_TIER_LIMITS.starter.messageLimitMonthly,
    agents: CANONICAL_TIER_LIMITS.starter.agentInvokeLimitMonthly,
    webhooks: CANONICAL_TIER_LIMITS.starter.webhookDeliveryLimitMonthly,
    tagline: "Production traffic with fixed monthly limits.",
    bullets: [
      "Higher quotas than Free",
      "Signed webhooks with retries",
      "GDPR export and erasure endpoints",
      "Email support (best effort)",
    ],
  },
  pro: {
    label: "Pro",
    price: "$49.99/mo",
    messages: CANONICAL_TIER_LIMITS.pro.messageLimitMonthly,
    agents: CANONICAL_TIER_LIMITS.pro.agentInvokeLimitMonthly,
    webhooks: CANONICAL_TIER_LIMITS.pro.webhookDeliveryLimitMonthly,
    tagline: "Heavy rooms, agents, and webhook volume.",
    bullets: [
      "5M messages, 100k agent invokes, 1M webhook deliveries per month",
      "Priority support",
      "Custom retention and audit (contact us)",
      "Annual invoicing on request",
    ],
  },
};
