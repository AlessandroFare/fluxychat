export interface CompareRow {
  label: string;
  stream: string;
  ably: string;
  pusher: string;
  fluxy: string;
}

export const COMPARE_ROWS: readonly CompareRow[] = [
  {
    label: "Edge-native (Cloudflare Workers + DO + D1)",
    stream: "Managed cloud",
    ably: "Managed cloud",
    pusher: "Managed cloud",
    fluxy: "Designed for Workers + DO + D1",
  },
  {
    label: "In-app chat + operator console",
    stream: "Separate product areas",
    ably: "Console + APIs",
    pusher: "Channels dashboard",
    fluxy: "First-party console in monorepo",
  },
  {
    label: "Headless SDK (optimistic sends, reconnect state)",
    stream: "Strong SDKs",
    ably: "Strong SDKs",
    pusher: "Channels SDKs",
    fluxy: "@fluxy-chat/sdk + vanilla store",
  },
  {
    label: "Agent tool events on room WebSocket",
    stream: "Varies",
    ably: "Separate products",
    pusher: "N/A",
    fluxy: "tool_call / tool_result on same timeline",
  },
  {
    label: "MIT self-host on your Cloudflare account",
    stream: "Proprietary",
    ably: "Managed-first",
    pusher: "Managed-first",
    fluxy: "Full monorepo, wrangler deploy",
  },
  {
    label: "Message templates + member preferences API",
    stream: "Varies",
    ably: "N/A",
    pusher: "Limited",
    fluxy: "POST /templates, member prefs PATCH",
  },
  {
    label: "Reconnect, replay, and delivery state in SDK",
    stream: "SDK features vary",
    ably: "SDK features vary",
    pusher: "Channels SDK",
    fluxy: "connectionState, loadMore, clientMessageId idempotency",
  },
  {
    label: "Socket fleet / VPS to operate",
    stream: "Managed vendor infra",
    ably: "Managed vendor infra",
    pusher: "Managed vendor infra",
    fluxy: "No VPS; one Room DO per room on CF edge",
  },
  {
    label: "Next.js on Vercel + realtime (typical split)",
    stream: "Managed cloud + your frontend",
    ably: "Ably + Vercel tutorial pattern",
    pusher: "Channels + serverless functions",
    fluxy: "Vercel/Netlify UI + CF Worker chat (no Vercel WS limits)",
  },
];

export interface AlternativeApproach {
  name: string;
  bestFor: string;
  tradeoff: string;
  fluxyAngle: string;
}

/** Cloudflare-adjacent or DIY stacks buyers compare mentally. */
export const ALTERNATIVE_APPROACHES: readonly AlternativeApproach[] = [
  {
    name: "PartyKit (+ DO demos on X)",
    bestFor: "Collab sessions, games, generic realtime “party” state — often mentioned beside Durable Objects in builder posts.",
    tradeoff: "Not tenant-scoped SaaS chat: no first-class multi-tenant JWT, D1 history ops, billing hooks, or operator console for your product.",
    fluxyAngle: "Pick FluxyChat when buyers need in-app messaging for customers, not a party runtime you extend into a full chat product.",
  },
  {
    name: "Workers + Upstash Redis (DIY)",
    bestFor: "Teams that want to assemble WS + Redis persistence themselves.",
    tradeoff: "You own ordering, reconnect, multi-tenant auth, and ops glue.",
    fluxyAngle: "FluxyChat is the chat layer pre-wired: room DO + D1 + SDK + console.",
  },
  {
    name: "Firebase / Supabase realtime",
    bestFor: "Greenfield apps already on that BaaS for auth + DB + everything.",
    tradeoff: "Heavier than a chat-only slice if you only need rooms + history.",
    fluxyAngle: "Edge split: static/SSR front + FluxyChat on CF for chat only.",
  },
  {
    name: "Full Cloudflare app frameworks",
    bestFor: "Auth, RBAC, queues, uploads, AI helpers in one starter kit.",
    tradeoff: "Realtime chat is one module among many — scope blur.",
    fluxyAngle: "FluxyChat replaces the chat/realtime slice, not your whole framework.",
  },
  {
    name: "Vercel WebSockets / PushFlo-style workarounds",
    bestFor: "Teams that want managed realtime without leaving Vercel’s billing envelope.",
    tradeoff: "Still a separate realtime product; WebSocket limits and pricing context on the host remain.",
    fluxyAngle: "Keep Vercel for the app shell; run chat on CF with room-per-DO isolation and one less socket vendor.",
  },
  {
    name: "DIY WebSockets on Vercel Functions (Rivet-style)",
    bestFor: "Builders assembling their own WS layer on serverless functions.",
    tradeoff: "You own connection lifecycle, scaling, auth, and ops — easy to underestimate.",
    fluxyAngle: "FluxyChat removes the DIY socket fleet for SaaS in-app chat; you integrate the SDK.",
  },
  {
    name: "Ably for Next.js / Vercel live apps",
    bestFor: "General realtime (live dashboards, pub/sub) with strong tutorials for Next.js.",
    tradeoff: "Broader than chat: history UI, templates, and tenant operator tooling are on you.",
    fluxyAngle: "FluxyChat is the chat layer (rooms, D1 history, console) on Workers + DO, not generic channels.",
  },
  {
    name: "Vask (Pusher-compatible on Cloudflare)",
    bestFor: "Teams wanting Pusher-shaped APIs on CF with “no fan-out fees” positioning.",
    tradeoff: "Compare their Pusher-compat surface vs your need for D1 history, agent timeline, MIT self-host console.",
    fluxyAngle: "FluxyChat is room-native chat infra (DO + D1 + SDK), not only channel-compat; evaluate lock-in, webhooks, and operator tooling.",
  },
  {
    name: "Self-hosted helpdesk (Libredesk-style)",
    bestFor: "Full support desk, ticketing, and customer-facing helpdesk UI.",
    tradeoff: "Not a drop-in chat API for your SaaS product’s in-app threads.",
    fluxyAngle: "FluxyChat is infrastructure for your app’s messaging — pair with your own support UI if needed.",
  },
  {
    name: "Node-RED WebSocket nodes",
    bestFor: "Teams that already orchestrate telco/CRM/call-center logic in flows they operate.",
    tradeoff: "You own socket reliability, scaling, and upgrades on your Node-RED runtime — not edge room isolation.",
    fluxyAngle: "FluxyChat when you want room fan-out + history on Cloudflare without maintaining WS infra; Node-RED when flows are the product and alerts are mostly pub/sub.",
  },
  {
    name: "Stoa Edge (CF-native live state)",
    bestFor: "Self-hosted edge meshes and live state subscriptions on Workers.",
    tradeoff: "Not a chat-specific layer (rooms, templates, agent timeline, operator console).",
    fluxyAngle: "FluxyChat for in-app chat and agent events; Stoa-like stacks for broader edge state patterns.",
  },
];

export const BUYING_FAQ = [
  {
    q: "We deploy on Vercel — can’t we use Vercel WebSockets?",
    a: "Many teams hit WebSocket limits, pricing, or ops friction on serverless hosts. A common pattern is Vercel/Netlify for the UI and FluxyChat on Cloudflare for room state — no second Pusher bill, no VPS socket fleet.",
  },
  {
    q: "Do I still need a separate WebSocket vendor?",
    a: "Not for in-app chat on Cloudflare: FluxyChat uses Workers + one Durable Object per room. You may still want telco APIs for SMS/WhatsApp.",
  },
  {
    q: "What about idle rooms and surprise Cloudflare bills?",
    a: "Room-scoped DOs limit blast radius vs one global socket server. You still need budget alerts, staging tests, and avoiding unbounded write loops into storage — see cost guardrails on /why.",
  },
  {
    q: "Reconnect and history on refresh?",
    a: "The SDK exposes connectionState (including reconnecting), REST history pagination (loadMore), and clientMessageId for idempotent retries.",
  },
  {
    q: "Export and backup?",
    a: "Self-host: messages live in your D1. Hosted: use GDPR export flows and your own backup policy for D1; you are not locked into a vendor’s message retention UI.",
  },
  {
    q: "Should I fork a DIY Durable Objects chat repo on GitHub?",
    a: "Great for learning. For SaaS in-app chat, compare the DIY checklist on this page — FluxyChat ships the same Room DO pattern plus JWT, history, reconnect SDK, and console.",
  },
  {
    q: "Shared state for humans and AI agents in one room?",
    a: "FluxyChat streams agent tool events on the same WebSocket as user messages — useful for copilots and agentic SaaS. See /guides/durable-objects-for-chat-rooms.",
  },
] as const;

export interface DiyComparisonRow {
  concern: string;
  diy: string;
  fluxy: string;
}

/** Build-vs-buy for GitHub DIY Durable Objects chat repos. */
export const DIY_DO_COMPARISON: readonly DiyComparisonRow[] = [
  {
    concern: "One Room DO per channel + WS fan-out",
    diy: "You implement accept(), broadcast, and cleanup",
    fluxy: "RoomDurableObject in MIT repo — same pattern, maintained",
  },
  {
    concern: "Multi-thread / multi-tenant chat",
    diy: "Custom schema + auth glue",
    fluxy: "Project-scoped JWT, room membership in D1",
  },
  {
    concern: "Chat history + pagination",
    diy: "D1/DB layer you design",
    fluxy: "D1 persistence + SDK loadMore()",
  },
  {
    concern: "Reconnect after DO hibernation",
    diy: "Client logic you own",
    fluxy: "connectionState, retry, SSE/polling fallback",
  },
  {
    concern: "Human + agent on same timeline",
    diy: "Separate pipelines",
    fluxy: "tool_call / tool_result on room WebSocket",
  },
  {
    concern: "Operator console + quotas",
    diy: "Not in demo repos",
    fluxy: "Dashboard + Worker enforcement",
  },
];

export const PUSHER_ON_VERCEL = {
  title: "FluxyChat vs Pusher on Vercel",
  intro:
    "Vercel documents Pusher as a common path for live features. FluxyChat keeps the socket layer on Cloudflare so you avoid a second vendor SKU and room limits on serverless functions.",
  bullets: [
    "Keep Next.js on Vercel; point @fluxy-chat/sdk at your Worker URL.",
    "Mint member JWTs in a Route Handler — no Pusher app keys in the browser.",
    "Map old channel names to roomIds; use REST + D1 for history instead of cache-only events.",
    "Self-host the Worker on your CF account when you need cost governance and opaque-socket-bill control.",
  ],
} as const;

export const ABLY_ON_VERCEL = {
  title: "FluxyChat vs Ably for in-app chat on Vercel",
  intro:
    "Ably’s Next.js starters own “realtime chat on Vercel” search. FluxyChat is the chat layer on Cloudflare Workers + DO — general pub/sub stays on Ably; tenant rooms, history, and operator tooling stay in FluxyChat.",
  bullets: [
    "Same split: Vercel for SSR/UI, Worker for WebSockets.",
    "Room-per-DO ordering and D1 history — not only channel events.",
    "Agent tool events on the room stream for copilot products.",
    "MIT self-host when lock-in and per-connection bills are the objection.",
  ],
} as const;

export const DECISION_FLOW = [
  {
    question: "Need SMS/WhatsApp to phones?",
    yes: "Use a telco API (e.g. Sent) alongside FluxyChat for in-app threads.",
    no: "Continue ↓",
  },
  {
    question: "Need collab/game “party” realtime (PartyKit-style), not product chat?",
    yes: "Consider PartyKit or generic edge realtime tooling.",
    no: "Continue ↓",
  },
  {
    question: "Frontend on Vercel/Netlify, need realtime without a socket VPS?",
    yes: "FluxyChat on Cloudflare + your existing frontend host.",
    no: "Continue ↓",
  },
  {
    question: "Need only pub/sub fan-out (no message history UI)?",
    yes: "Consider Ably/Pusher-style channels.",
    no: "FluxyChat fits: rooms, history, presence, agents.",
  },
  {
    question: "Must run on your Cloudflare account?",
    yes: "MIT self-host FluxyChat.",
    no: "Try hosted beta or self-host — same API shape.",
  },
] as const;
