/**
 * Privacy / GDPR copy for the operator console (May 2026).
 * Retention numbers match Worker defaults; change here when product policy changes.
 */

export const PRIVACY_UPDATED = "May 2026";

export const RETENTION_DEFAULTS = [
  { label: "Messages", detail: "365 days by default; soft-deleted rows are purged on schedule" },
  { label: "Audit events", detail: "90 days" },
  { label: "Agent runs", detail: "180 days" },
  { label: "Usage records", detail: "730 days (24 months) for billing reconciliation" },
  { label: "Webhook deliveries", detail: "30 days" },
] as const;

export const SUB_PROCESSORS = [
  {
    name: "Cloudflare",
    role: "Hosts the Worker, D1, R2, and Durable Objects when you deploy on Cloudflare",
  },
  {
    name: "Clerk",
    role: "Hosted sign-in for the dashboard (optional; only if NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is set)",
  },
  {
    name: "Stripe",
    role: "Subscription billing when payments are enabled on your Worker",
  },
  {
    name: "OpenAI / Anthropic (or your gateway)",
    role: "LLM inference when in-room agents are configured to call them",
  },
] as const;
