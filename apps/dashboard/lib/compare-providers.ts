export interface CompareRow {
  label: string;
  portal: string;
  stream: string;
  ably: string;
  pusher: string;
  fluxy: string;
}

export const COMPARE_ROWS: readonly CompareRow[] = [
  {
    label: "Edge-native (Cloudflare Workers + DO + D1)",
    portal: "Managed SaaS — not Workers/DO-first",
    stream: "Managed cloud",
    ably: "Managed cloud",
    pusher: "Managed cloud",
    fluxy: "Designed for Workers + DO + D1",
  },
  {
    label: "Multi-platform adapters (14 platforms)",
    portal: "Web/React SDK — not 14 channel adapters",
    stream: "Limited / separate product",
    ably: "N/A",
    pusher: "N/A",
    fluxy: "Slack, Discord, Telegram, WhatsApp, Teams, +9 — unified interface",
  },
  {
    label: "AI-native streaming (markdown, tool calling)",
    portal: "Core — streaming agents + tool calls",
    stream: "Add-on / separate product",
    ably: "N/A",
    pusher: "N/A",
    fluxy: "Streaming markdown, tool_call/tool_result, HITL approval",
  },
  {
    label: "MCP client integration",
    portal: "MCP apps / tool server integrations",
    stream: "N/A",
    ably: "N/A",
    pusher: "N/A",
    fluxy: "Consume any MCP tool server — auto-convert to function-calling",
  },
  {
    label: "LLM middleware pipeline",
    portal: "Middleware hooks in SDK",
    stream: "N/A",
    ably: "N/A",
    pusher: "N/A",
    fluxy: "wrapGenerate / wrapStream / transformParams — guardrails, RAG, PII",
  },
  {
    label: "Durable agent execution (WorkflowAgent)",
    portal: "Hosted agent runtime",
    stream: "N/A",
    ably: "N/A",
    pusher: "N/A",
    fluxy: "Persists to D1, survives deploys, auto-resume from last step",
  },
  {
    label: "In-app chat + operator console",
    portal: "Hosted Portal dashboard",
    stream: "Separate product areas",
    ably: "Console + APIs",
    pusher: "Channels dashboard",
    fluxy: "First-party console in monorepo",
  },
  {
    label: "Headless SDK (optimistic sends, reconnect state)",
    portal: "Excellent DX — package split, SSR-safe hooks",
    stream: "Strong SDKs",
    ably: "Strong SDKs",
    pusher: "Channels SDKs",
    fluxy: "@fluxy-chat/sdk + vanilla store",
  },
  {
    label: "Agent tool events on room WebSocket",
    portal: "Same room timeline",
    stream: "Varies",
    ably: "Separate products",
    pusher: "N/A",
    fluxy: "tool_call / tool_result on same timeline",
  },
  {
    label: "Message templates + member preferences API",
    portal: "Templates + member prefs",
    stream: "Varies",
    ably: "N/A",
    pusher: "Limited",
    fluxy: "POST /templates, member prefs PATCH",
  },
  {
    label: "Reconnect, replay, and delivery state in SDK",
    portal: "connectionState + replay patterns",
    stream: "SDK features vary",
    ably: "SDK features vary",
    pusher: "Channels SDK",
    fluxy: "connectionState, loadMore, clientMessageId idempotency",
  },
  {
    label: "Read receipts / unread badges",
    portal: "Inbox + read watermarks",
    stream: "Product features vary",
    ably: "Varies by product",
    pusher: "Not first-class in Channels",
    fluxy: "markReadLatest + room list unread in SDK/console",
  },
  {
    label: "In-app notifications (mentions, DMs)",
    portal: "Unified inbox feed",
    stream: "Separate notification products",
    ably: "Separate products",
    pusher: "Beams (separate SKU)",
    fluxy: "REST + SDK useNotifications on same Worker",
  },
  {
    label: "Message middleware (validate / filter / enrich)",
    portal: "Server-side hooks",
    stream: "Varies",
    ably: "N/A",
    pusher: "Webhooks only",
    fluxy: "Edge pipeline before persist + broadcast",
  },
  {
    label: "Unified room WebSocket (chat + server_event + capability)",
    portal: "Chat timeline only",
    stream: "Separate channel products",
    ably: "Pub/sub channels",
    pusher: "Channels only",
    fluxy: "One WS: messages, game/IoT/live/fleet/poll fan-out, vertical capability events",
  },
  {
    label: "Live streaming & broadcast (HLS, polls, highlights)",
    portal: "Not core (chat-first product)",
    stream: "Video product / add-on",
    ably: "Separate live product",
    pusher: "Channels only (no HLS stack)",
    fluxy: "FluxyStream: events, broadcast, polls, AI co-host on same Worker",
  },
  {
    label: "Real-time collab (Yjs / CRDT whiteboard)",
    portal: "Not core",
    stream: "Feeds / activity",
    ably: "Pub/sub channels",
    pusher: "N/A",
    fluxy: "Collab DO adapter + Excalidraw/Yjs in SDK",
  },
  {
    label: "Game multiplayer (matchmaking, replay, NPC)",
    portal: "N/A",
    stream: "N/A",
    ably: "N/A",
    pusher: "Presence only",
    fluxy: "FluxyGame: lobbies, authoritative ticks, D1 leaderboard",
  },
  {
    label: "IoT & device sync (MQTT, shadow, rules)",
    portal: "N/A",
    stream: "N/A",
    ably: "IoT messaging (separate)",
    pusher: "N/A",
    fluxy: "FluxyIoT: fleets, readings, rules, geofence on Worker",
  },
  {
    label: "Fleet & live location tracking",
    portal: "N/A",
    stream: "N/A",
    ably: "Location / maps partners",
    pusher: "N/A",
    fluxy: "FluxyFleet: trips, ETA, driver tracking APIs + fleet.gps_update on room WS",
  },
  {
    label: "Spatial / digital twin rooms",
    portal: "N/A",
    stream: "N/A",
    ably: "N/A",
    pusher: "N/A",
    fluxy: "Scenes + spatial.entity_added fan-out on room WS",
  },
  {
    label: "Voice + AI transport pipeline",
    portal: "Voice varies — chat-first SDK",
    stream: "Voice / video add-ons",
    ably: "Separate products",
    pusher: "N/A",
    fluxy: "useVoice (production) + transport fallback on room WebSocket",
  },
  {
    label: "Cross-channel continuity & customer memory",
    portal: "Inbox + continuity focus",
    stream: "CRM integrations",
    ably: "N/A",
    pusher: "N/A",
    fluxy: "CDP graph + journey mapping + A2A tasks on Worker",
  },
  {
    label: "Pricing surprises at scale",
    portal: "Hosted SaaS tiers",
    stream: "Enterprise / usage tiers",
    ably: "Usage-based",
    pusher: "Free tier small; connections add up",
    fluxy: "Cloudflare pricing you can read; MIT self-host option",
  },
  {
    label: "Self-host / on your own account",
    portal: "Proprietary cloud — no MIT self-host",
    stream: "Proprietary cloud",
    ably: "Managed-first",
    pusher: "Managed-first",
    fluxy: "Full MIT monorepo — deploy Worker + D1 in your CF account",
  },
  {
    label: "Socket fleet / VPS to operate",
    portal: "Managed vendor infra",
    stream: "Managed vendor infra",
    ably: "Managed vendor infra",
    pusher: "Managed vendor infra",
    fluxy: "No VPS; one Room DO per room on CF edge",
  },
  {
    label: "Next.js on Vercel + realtime (typical split)",
    portal: "Frontend-agnostic hosted API",
    stream: "Managed cloud + your frontend",
    ably: "Ably + Vercel tutorial pattern",
    pusher: "Channels + serverless functions",
    fluxy: "Vercel/Netlify UI + CF Worker chat (no Vercel WS limits)",
  },
  {
    label: "Omnichannel inbox (mentions, unread, follow-ups)",
    portal: "Unified inbox + onItem over user channel",
    stream: "Separate feeds product",
    ably: "N/A",
    pusher: "N/A",
    fluxy: "useInbox items feed + REST /inbox + console badge",
  },
  {
    label: "MIT license — read and deploy the full stack",
    portal: "Proprietary hosted service",
    stream: "Proprietary cloud",
    ably: "Managed-first",
    pusher: "Managed-first",
    fluxy: "MIT monorepo — Worker, SDK, console, no vendor lock-in",
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
    name: "Portal (chat-first SDK)",
    bestFor: "Teams optimizing for React DX — SSR-safe hooks, inbox feed, streaming agents, hosted dashboard.",
    tradeoff: "Proprietary hosted service — no MIT self-host on your Cloudflare account; broader platform modules (stream, IoT, fleet) are on you.",
    fluxyAngle: "FluxyChat matches Portal on inbox/useInbox, connection UX, and AI timeline — adds MIT self-host, Workers/DO-native deployment, and 14 channel adapters.",
  },
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
    name: "Chatsemble (GPL workspace app)",
    bestFor: "Self-hosted team chat + in-room agents + workflows/MCP in one React app (one DO per org, SQLite inside the DO).",
    tradeoff: "GPL-3.0; not a headless API — you adopt their product shape or fork the monolith.",
    fluxyAngle: "FluxyChat is MIT chat infrastructure: room-per-DO, D1, SDK, operator console — embed in your SaaS without their UI.",
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
    a: "Not for in-app chat, collab, game, or IoT on Cloudflare: FluxyChat uses Workers + one Durable Object per room. You may still want telco APIs for SMS/WhatsApp or a dedicated SFU for large video rooms.",
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

export const PUSHER_BILL_SHOCK = {
  title: "When the Pusher bill catches up",
  intro:
    "Same story in every thread: the free tier is fine for a demo, then connection and message pricing climbs faster than the app. FluxyChat is not a flat-fee miracle — you still pay Cloudflare — but you can self-host on your account, read the MIT source, and drop a second vendor's connection counter.",
  bullets: [
    "Try hosted beta first; self-host when pricing starts to matter in the evaluation.",
    "One Durable Object per room keeps cost and failure scoped to that room, not one global socket server.",
    "D1 history and REST pagination instead of cache-only channel events you stitch back together.",
    "Same SDK for hosted and self-host — swap Worker URL and keys, not your client code.",
  ],
} as const;

export const SELF_HOST_POSITIONING = {
  title: "Self-host on your Cloudflare account",
  intro:
    "A lot of teams shopping Pusher or Ably alternatives ask the same thing: can we run it ourselves? With FluxyChat, yes — that is the default story, not a footnote in the pricing page.",
  bullets: [
    "Deploy apps/worker and run D1 migrations on your Cloudflare account (MIT monorepo).",
    "Same console and @fluxy-chat/sdk as hosted beta; you wire Clerk and Stripe if you want them.",
    "JWT tenants, webhooks, GDPR export, and message middleware all run on your Worker.",
  ],
} as const;

export const BUILD_VS_BUY = {
  title: "Build vs buy",
  intro:
    "Pusher vs Socket.IO is really build vs buy. FluxyChat is the middle path: one realtime platform (chat, agents, stream, collab, game, IoT, fleet, spatial, 14 channels) with less ops than rolling your own socket cluster and more control than a closed channels vendor.",
  bullets: [
    "DIY Socket.IO on a VM: you own reconnect, history, multi-tenant auth, and on-call.",
    "Pusher / Ably / Stream: fast start, usage pricing, separate SKUs for video, push, and AI.",
    "FluxyChat: room DO + D1 + SDK + console for the full stack; MIT self-host when lock-in or bill shock is the objection.",
  ],
} as const;

export const PRODUCT_CHAT_VS_SUPPORT = {
  title: "In-app realtime platform, not a support desk",
  intro:
    "Most live-chat listicles are written for support teams: inbox, macros, CSAT. FluxyChat is for realtime inside your product — tenant rooms, SDK embed, streaming, collab, game, IoT, fleet, spatial, and agent events on the same timeline. Wire Salesforce or HubSpot through your own integration layer; we handle the room kernel.",
  bullets: [
    "Helpdesk products sell ticketing and agent assignment. We sell transport, history, JWT rooms, platform modules, and webhooks.",
    "User messages and agent tool_call / tool_result share one WebSocket stream, so you can replay what happened.",
    "Stream, collab, game, IoT, and fleet modules reuse the same Worker — not a patchwork of vendor SKUs.",
  ],
} as const;

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
    no: "FluxyChat fits: rooms, history, presence, agents, stream, collab, game, IoT.",
  },
  {
    question: "Must run on your Cloudflare account?",
    yes: "MIT self-host FluxyChat.",
    no: "Try hosted beta or self-host — same API shape.",
  },
] as const;

