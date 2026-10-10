/**
 * Landing copy aligned with docs/marketing/*.md — single source for the public site.
 */

export const MARKETING_HERO = {
  eyebrow: "MIT on your Cloudflare account",
  headlineLead: "Humans and agents",
  headlineAccent: "in the same room",
  subhead:
    "Chat in one product, the doc in another, the agent somewhere else. Permissions get copied. State drifts. You cannot replay the tool call. Here they sit on one room Durable Object. Public rooms take a publishable key in the browser. Self-host is MIT. Hosted is beta.",
} as const;

export const MARKETING_WHY = {
  title: "What you stop paying for",
  body: "Chat, presence, Yjs, and an agent sit on one Durable Object. Hosted is beta. Self-host is MIT. Pusher moves bytes. Liveblocks is the document. Stream Chat is a hosted chat product with channels and moderation.",
} as const;

export const MARKETING_PLATFORM_FEATURES = [
  "One room Durable Object: chat, presence, Yjs, invokeAgent",
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
    body: "Create the Slack, Discord, Telegram, WhatsApp, or Teams app yourself. Paste the token in the console and point the webhook at the Worker. SMS to phones still needs a telco. WhatsApp in the EU is in a Commission case right now. We don't sell a WhatsApp channel.",
  },
  {
    title: "Export, erasure, webhooks",
    body: "GDPR export and erasure run on the Worker. Webhooks are signed.",
  },
  {
    title: "Ship without a socket fleet",
    body: "JWT, the SDK, and a console. You don't have to keep a socket fleet alive at 3am.",
  },
] as const;

export const MARKETING_ENTERPRISE = {
  eyebrow: "Cross-org rooms",
  title: "A room other organisations can join",
  intro:
    "Cloudflare Agents is one agent in a Durable Object. This is a room. Two companies can sit in it with private whispers. Dangerous tools wait for a human. We wrap the payload on the Worker and can sign an export. Anyone with Worker secrets can unwrap. The model sees plaintext on invoke.",
  items: [
    "Cross-org rooms and private terms",
    "Quorum on dangerous tools, on the same WebSocket as chat",
    "Worker-wrapped payload and a signed export. You do not hold a customer KMS.",
    "Room SQLite PITR (30-day bookmarks, restore on next wake)",
    "SSO and SCIM on self-host. Hosted login does not include SAML.",
    "Audit logs, retention, legal hold, GDPR export",
    "Per-tool approval gates and OpenTelemetry gen_ai spans",
  ],
} as const;

export const MARKETING_FINAL_CTA = {
  title: "Same SDK on hosted or on your Cloudflare account.",
  body: "Free has no card. Public rooms take a pk_. Private rooms take a member JWT minted with fc_ on the server. Hosted is beta. Self-host if procurement asks who owns D1.",
  primaryLabel: "Start free",
  secondaryLabel: "Book a pilot",
  secondaryHref: "mailto:founder@fluxychat.com?subject=FluxyChat%20pilot",
} as const;

export const PRICING_FAQ = [
  {
    q: "Is chat end-to-end encrypted?",
    a: "TLS in transit. You can wrap payloads with a room key the Worker holds. Anyone with Worker secrets can unwrap. The model sees plaintext when invokeAgent runs. There is no customer KMS.",
  },
  {
    q: "Do agents count as seats or MAU?",
    a: "No. Console seats are humans. Agents cost invokes: streaming replies, tool calls, MCP. A chatty bot is not extra MAU.",
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

