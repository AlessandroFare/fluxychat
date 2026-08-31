/**
 * Landing copy aligned with docs/marketing/*.md — single source for the public site.
 */

export const MARKETING_HERO = {
  eyebrow: "Your product is a room",
  headlineLead: "Humans and agents",
  headlineAccent: "in the same room",
  subhead:
    "Chat, live presence, a shared document, and an agent on the same Durable Object. Public rooms use a pk_ in the browser. Self-host is MIT. Hosted is still beta.",
} as const;

export const MARKETING_WHY = {
  title: "Why teams pick FluxyChat",
  body: "The unit of value is a room: chat, presence, Yjs, and an agent on one Cloudflare Durable Object. MIT self-host or hosted beta. Not Pusher, not Liveblocks, not Stream.",
} as const;

export const MARKETING_PLATFORM_FEATURES = [
  "One room Durable Object: chat, sendCursor, Yjs, invokeAgent, HTTP ingest",
  "Guest session or pk_ for public rooms; fc_ stays on the server",
  "fluxy.config onPublish plus hosted D1 overlay (no forked Worker)",
  "Bridges: you create Slack/Discord/Telegram apps on the same table",
  "Voice signaling (joinVoiceStage); media is LiveKit",
  "GDPR export/erasure on the Worker",
  "Named SDK errors (not_member, token_expired, anonymous_not_allowed)",
  "Open beta hosted. Pin npm versions.",
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
  body: "Start on the free tier. Guest rooms and pk_ first, then mint fc_ JWTs. Hosted is beta. Self-host MIT when you want the Worker in your account.",
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
    a: "Business is high-limit self-serve with SSO add-on and audit export. Enterprise can add SCIM, DLP, a security review, and a written MSA. There is no public fleet SLO on this page.",
  },
  {
    q: "What counts as a message?",
    a: "Persisted chat messages (including agent replies on the timeline) and client_event frames that are not client-ephemeral-*. Cursors, typing, and presence_patch do not increment the message quota. Agent invokes are a separate meter. Room ids are not metered.",
  },
  {
    q: "Is there a hackathon or maker plan?",
    a: "Free is that plan. No card. Public rooms with a pk_ in the client. 200k persisted messages and 5k agent invokes per month. Hosted is beta. Self-host is MIT.",
  },
  {
    q: "Is hosted production-ready?",
    a: "Hosted is open beta. Pin npm versions. Cloudflare PoP RTT is Cloudflare's, not a FluxyChat SLA. Self-host MIT if you need the Worker in your account today.",
  },
  {
    q: "Self-host vs hosted?",
    a: "Same worker and SDK. Hosted is fastest to start; self-host gives full control on your Cloudflare account with MIT source.",
  },
] as const;

