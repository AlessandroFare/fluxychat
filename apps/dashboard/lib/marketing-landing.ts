/**
 * Landing copy aligned with docs/marketing/*.md — single source for the public site.
 */

export const MARKETING_HERO = {
  eyebrow: "Realtime platform on Cloudflare",
  headlineLead: "Ship in-app chat",
  headlineAccent: "today",
  subhead:
    "Realtime chat, AI agents, and enterprise governance — without vendor lock-in. Self-host on Workers or use hosted cloud; integrate with @fluxy-chat/sdk in minutes.",
  platformNote:
    "Omnichannel inbox, compliance tooling, embed widget, and MCP — one worker, not four separate vendors.",
} as const;

export const MARKETING_WHY = {
  title: "Why teams pick FluxyChat",
  body: "Many products stitch together chat, support, AI, and governance from different vendors. That stack gets expensive, hard to audit, and painful to migrate. FluxyChat keeps rooms, agents, inbox, and compliance hooks on the edge you already run.",
} as const;

export const MARKETING_PLATFORM_FEATURES = [
  "Self-hosted realtime messaging",
  "Native AI with memory, knowledge graph, and actions",
  "Omnichannel inbox",
  "Compliance and audit trail",
  "Embeddable widget and custom domain",
  "MCP for agents and automations",
] as const;

export const MARKETING_USE_CASES = [
  {
    title: "B2B SaaS with support",
    body: "In-app rooms beside your product data, agent queue, handoff, and webhooks into your CRM.",
  },
  {
    title: "Developer teams shipping fast",
    body: "JWT, SDK hooks, and a console for day-two ops — without becoming WebSocket infrastructure experts.",
  },
  {
    title: "Regulated companies",
    body: "Audit export, retention policies, SSO/SCIM paths, and data control on your Cloudflare account.",
  },
  {
    title: "Communities and live events",
    body: "Presence, polls, hybrid events, and moderation queues for high-signal rooms at scale.",
  },
] as const;

export const MARKETING_ENTERPRISE = {
  title: "Enterprise-ready",
  intro: "Self-serve plans cover most production traffic. When governance matters, these capabilities are built into the worker — not a separate SKU bolted on later.",
  items: [
    "SSO / SCIM",
    "Audit logs and export schedules",
    "Retention policies",
    "IP whitelisting",
    "DLP integrations",
    "SLA tooling and enterprise support",
  ],
} as const;

export const MARKETING_FINAL_CTA = {
  title: "Build the realtime layer your product was missing.",
  body: "Start on the free tier, run a pilot on hosted cloud, or deploy the worker in your account when you are ready.",
  primaryLabel: "Start free",
  secondaryLabel: "Book a pilot",
  secondaryHref: "mailto:fluxychat@outlook.com?subject=FluxyChat%20pilot",
} as const;

export const PRICING_FAQ = [
  {
    q: "Why usage-based quotas?",
    a: "Real cost scales with messages, AI invokes, and webhook volume. Self-serve plans include fixed monthly quotas; heavy usage can be metered on Growth and above.",
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

