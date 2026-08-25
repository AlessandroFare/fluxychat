/**
 * Landing copy aligned with docs/marketing/*.md — single source for the public site.
 */

export const MARKETING_HERO = {
  eyebrow: "Realtime platform on Cloudflare",
  headlineLead: "Ship chat and live product",
  headlineAccent: "from one SDK",
  subhead:
    "In-app chat, voice AI, live location, stream, collab, and device sync, plus Slack, Discord, and 12 more channels. Self-host on Workers or start on hosted cloud.",
} as const;

export const MARKETING_WHY = {
  title: "Why teams pick FluxyChat",
  body: "Most teams glue together chat, AI, support, and compliance from different vendors. That gets expensive and hard to audit. FluxyChat puts 14 platform adapters, streaming AI, MCP tools, and governance hooks on the edge you already run.",
} as const;

export const MARKETING_PLATFORM_FEATURES = [
  "14 platform adapters (Slack, Discord, Telegram, WhatsApp, Teams, +9)",
  "AI-native streaming with tool calling & HITL approval",
  "MCP client for external tool servers",
  "LLM middleware pipeline (guardrails, caching, RAG, PII redaction)",
  "WorkflowAgent for durable agent execution",
  "Card builder with Slack Block Kit & Teams Adaptive Cards",
  "DevTools playground & OpenTelemetry tracing",
  "GDPR export, audit trails, and retention policies",
] as const;

export const MARKETING_USE_CASES = [
  {
    title: "AI-powered SaaS with in-app chat",
    body: "Stream AI responses with tool calling, build copilots with HITL approval, and ship agent features on the same WebSocket as user messages.",
  },
  {
    title: "Multi-platform messaging apps",
    body: "One adapter interface across Slack, Discord, Telegram, WhatsApp, Teams, and 9 more. Unified card builder for rich messages across platforms.",
  },
  {
    title: "Regulated & compliance-heavy teams",
    body: "GDPR export, erasure, audit trails, retention policies, and signed webhooks, enforced at the edge rather than sold as a separate SKU.",
  },
  {
    title: "Developer teams shipping fast",
    body: "JWT auth, SDK hooks, create-fluxy-chat CLI scaffolding, and a console for day-two ops, without becoming WebSocket infrastructure experts.",
  },
] as const;

export const MARKETING_ENTERPRISE = {
  eyebrow: "Enterprise default",
  title: "The room Cloudflare Agents will not ship",
  intro:
    "Agents give a developer a Durable Object. FluxyChat is the multi-tenant room those agents join: two orgs in one thread, quorum on the dangerous tools, and an E2EE envelope with a signed export. That is the default enterprise story — not a bolt-on SKU.",
  items: [
    "Cross-org rooms, private terms, and settlements",
    "Critical-action quorum on the same WebSocket as chat",
    "E2EE group cipher + signed conversation attestation",
    "Room SQLite PITR (30-day bookmarks, restore on next wake)",
    "SSO / SAML & SCIM provisioning",
    "Audit logs, retention, legal hold, GDPR export",
    "Per-tool HITL gates and OpenTelemetry gen_ai spans",
  ],
} as const;

export const MARKETING_FINAL_CTA = {
  title: "Build AI-native chat on infrastructure you own.",
  body: "Start on the free tier with 14 platform adapters, streaming AI, and MCP tools. Run a pilot on hosted cloud, or deploy the worker in your Cloudflare account when you are ready.",
  primaryLabel: "Start free",
  secondaryLabel: "Book a pilot",
  secondaryHref: "mailto:fluxychat@outlook.com?subject=FluxyChat%20pilot",
} as const;

export const PRICING_FAQ = [
  {
    q: "Why usage-based quotas?",
    a: "Cost tracks messages, AI invokes, and webhook volume. Self-serve plans include fixed monthly quotas; heavy usage can be metered on Growth and above.",
  },
  {
    q: "Do AI agent invokes count against my quota?",
    a: "Yes. Each plan includes a monthly agent invoke limit. Streaming AI, tool calls, and MCP interactions count as invokes.",
  },
  {
    q: "Are stream, collab, game, and IoT modules extra?",
    a: "No separate SKU. Platform modules run on the same room and worker. Quotas apply to messages and agent invokes like chat.",
  },
  {
    q: "Enterprise vs Business?",
    a: "Business is high-limit self-serve with SSO add-on and audit export. Enterprise adds SCIM, SLA, DLP, security review, and dedicated support.",
  },
  {
    q: "Self-host vs hosted?",
    a: "Same worker and SDK. Hosted is fastest to start; self-host gives full control on your Cloudflare account with MIT source.",
  },
] as const;

