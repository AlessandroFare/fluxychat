export const PLAN_NAME_OPTIONS = [
  { value: "free", label: "Free", description: "Beta / default tier" },
  { value: "starter", label: "Starter", description: "Small production workloads" },
  { value: "growth", label: "Growth", description: "Higher quotas" },
  { value: "enterprise", label: "Enterprise", description: "Custom limits" },
] as const;

export const BILLING_STATUS_OPTIONS = [
  { value: "manual", label: "Manual", description: "Quotas set in this console (no Stripe)" },
  { value: "active", label: "Active", description: "Paid via Stripe" },
  { value: "trialing", label: "Trialing", description: "Stripe trial period" },
  { value: "past_due", label: "Past due", description: "Payment failed" },
  { value: "canceled", label: "Canceled", description: "Subscription ended" },
] as const;
