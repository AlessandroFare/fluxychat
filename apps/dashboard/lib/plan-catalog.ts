/**
 * Public plan labels and display limits (billing UI, future marketing).
 * Runtime enforcement reads limits from D1 `project_plans`; keep numbers aligned when changing tiers.
 */
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

export const PUBLIC_PLAN_CATALOG: Record<string, PublicPlanRow> = {
  free: {
    label: "Free",
    price: "$0/mo",
    messages: 50_000,
    agents: 1_000,
    webhooks: 10_000,
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
    messages: 500_000,
    agents: 10_000,
    webhooks: 100_000,
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
    messages: 5_000_000,
    agents: 100_000,
    webhooks: 1_000_000,
    tagline: "Heavy rooms, agents, and webhook volume.",
    bullets: [
      "5M messages, 100k agent invokes, 1M webhook deliveries per month",
      "Priority support",
      "Custom retention and audit (contact us)",
      "Annual invoicing on request",
    ],
  },
};
