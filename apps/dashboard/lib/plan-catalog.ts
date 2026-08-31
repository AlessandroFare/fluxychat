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
export const CANONICAL_TIER_LIMITS: Readonly<
  Record<"starter" | "pro" | "team" | "growth", CanonicalTierLimits>
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

/** Default free-tier limits. Mirrors the worker's `getDefaultQuotaLimit` defaults
 *  (200k messages, 5k agent invokes, 50k webhook deliveries). Kept here so the
 *  dashboard renders a faithful preview when no env is available. */
export const FREE_TIER_LIMITS: CanonicalTierLimits = Object.freeze({
  messageLimitMonthly: 200_000,
  agentInvokeLimitMonthly: 5_000,
  webhookDeliveryLimitMonthly: 50_000,
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
      "SCIM. Written SLA only with a signed MSA (not a public uptime number).",
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
    tagline: "Weekend plan. No card. pk_ in the browser.",
    bullets: [
      "Public rooms with publishableKey. Cursors do not count as messages.",
      "200k persisted messages and 5k agent invokes per month",
      "MIT self-host if you want the Worker in your account",
      "Community support on GitHub",
    ],
  },
  starter: {
    label: "Starter",
    price: "$20/mo",
    messages: CANONICAL_TIER_LIMITS.starter.messageLimitMonthly,
    agents: CANONICAL_TIER_LIMITS.starter.agentInvokeLimitMonthly,
    webhooks: CANONICAL_TIER_LIMITS.starter.webhookDeliveryLimitMonthly,
    tagline: "Production traffic with fixed monthly limits.",
    bullets: [
      "Room kernel: chat, presence, Yjs, agents",
      "Signed webhooks with retries",
      "GDPR export and erasure endpoints",
      "Email support (best effort)",
    ],
  },
  pro: {
    label: "Pro",
    price: "$50/mo",
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
  team: {
    label: "Team",
    price: "$99/mo",
    messages: CANONICAL_TIER_LIMITS.team.messageLimitMonthly,
    agents: CANONICAL_TIER_LIMITS.team.agentInvokeLimitMonthly,
    webhooks: CANONICAL_TIER_LIMITS.team.webhookDeliveryLimitMonthly,
    tagline: "Multiple projects, more seats, same compliance posture as Pro.",
    bullets: [
      "20M messages, 200k agent invokes, 1M webhook deliveries per month",
      "Up to 5 projects and 5 team seats",
      "Team member management and RBAC",
      "Priority support, annual invoicing on request",
    ],
  },
  growth: {
    label: "Growth",
    price: "From $199/mo",
    messages: CANONICAL_TIER_LIMITS.growth.messageLimitMonthly,
    agents: CANONICAL_TIER_LIMITS.growth.agentInvokeLimitMonthly,
    webhooks: CANONICAL_TIER_LIMITS.growth.webhookDeliveryLimitMonthly,
    tagline: "B2B SaaS with omnichannel, AI memory, and FTS search.",
    bullets: [
      "Multiple projects, omnichannel inbox (base)",
      "AI memory and full-text search",
      "Light moderation tooling",
      "Annual invoicing on request",
    ],
  },
};

