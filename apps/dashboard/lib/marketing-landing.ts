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
  body: "Chat, presence, Yjs, and an agent sit on one Durable Object. Hosted is beta. Self-host is MIT. Pusher is transport. Liveblocks is the document. Stream is consumer chat.",
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
    title: "In-app chat with an agent",
    body: "The agent writes on the same WebSocket as your users. Tool calls show up in the timeline. If you want a copilot panel, that is separate UI and it does not write the room log.",
  },
  {
    title: "Bridges",
    body: "Create the Slack, Discord, Telegram, WhatsApp, or Teams app yourself. Paste the token in the console and point the webhook at the Worker. SMS to phones still needs a telco.",
  },
  {
    title: "Export, erasure, webhooks",
    body: "GDPR export and erasure run on the Worker. Webhooks are signed. We do not sell that as a separate SKU.",
  },
  {
    title: "Ship without a socket fleet",
    body: "JWT, the SDK, and a console. You do not have to be the person who keeps WebSockets alive at 3am.",
  },
] as const;

export const MARKETING_ENTERPRISE = {
  eyebrow: "Enterprise default",
  title: "The room Cloudflare Agents will not ship",
  intro:
    "Cloudflare Agents give you a Durable Object. FluxyChat is the room other orgs can join: private terms, quorum on the dangerous tools, a group cipher and a signed export. E2EE only if you keep the key. We never see it.",
  items: [
    "Cross-org rooms, private terms, and settlements",
    "Critical-action quorum on the same WebSocket as chat",
    "Group cipher and signed export. E2EE only if you keep the key.",
    "Room SQLite PITR (30-day bookmarks, restore on next wake)",
    "SSO / SAML & SCIM provisioning",
    "Audit logs, retention, legal hold, GDPR export",
    "Per-tool HITL gates and OpenTelemetry gen_ai spans",
  ],
} as const;

export const MARKETING_FINAL_CTA = {
  title: "Same SDK on hosted or on your Cloudflare account.",
  body: "Free has no card. Public rooms take a pk_. Private rooms take a member JWT minted with fc_ on the server. Hosted is beta. Self-host when procurement asks who owns D1.",
  primaryLabel: "Start free",
  secondaryLabel: "Book a pilot",
  secondaryHref: "mailto:fluxychat@outlook.com?subject=FluxyChat%20pilot",
} as const;

export const PRICING_FAQ = [
  {
    q: "Is chat end-to-end encrypted?",
    a: "TLS in transit. If you want E2EE, you hold the key. Double Ratchet for private rooms is still on the roadmap.",
  },
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

