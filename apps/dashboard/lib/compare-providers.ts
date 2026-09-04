export interface CompareRow {
  label: string;
  /** Hosted proprietary chat SDK column (internal key: legacy `portal`). */
  portal: string;
  stream: string;
  ably: string;
  pusher: string;
  fluxy: string;
}

/** Public column header for the hosted chat SDK competitor column. */
export const COMPARE_HOSTED_CHAT_HEADER = "Hosted chat SDK";

export const COMPARE_ROWS: readonly CompareRow[] = [
  {
    label: "Unit of value",
    portal: "Channel log + extensions (cloud)",
    stream: "Consumer chat SaaS",
    ably: "Pub/sub network",
    pusher: "Pub/sub channels",
    fluxy: "The room: chat, presence, Yjs, invokeAgent on one Durable Object",
  },
  {
    label: "pk_ in the browser (public rooms)",
    portal: "Yes (pk_, anonymous)",
    stream: "Usually user tokens",
    ably: "Token auth typical",
    pusher: "Public channels",
    fluxy: "Yes: publishableKey + POST /tokens/anonymous. fc_ stays on the server",
  },
  {
    label: "MIT server you can fork",
    portal: "Client MIT only. Sockets are their cloud",
    stream: "No",
    ably: "No",
    pusher: "No",
    fluxy: "Yes. Worker + D1 in your Cloudflare account",
  },
  {
    label: "Chat history + pagination",
    portal: "Channel history",
    stream: "Yes",
    ably: "Chat add-on / extra SKU",
    pusher: "Cache-ish events",
    fluxy: "D1 + useChat loadMore",
  },
  {
    label: "First-class live cursors",
    portal: "Ephemeral send (guide)",
    stream: "No",
    ably: "Spaces (partial)",
    pusher: "No",
    fluxy: "sendCursor / type cursor. Not client_event",
  },
  {
    label: "Yjs / shared document",
    portal: "Not the product",
    stream: "No",
    ably: "Spaces Yjs coming soon",
    pusher: "No",
    fluxy: "FluxyYjsProvider on the same room object",
  },
  {
    label: "Agent on the room timeline",
    portal: "Your bot or an extension",
    stream: "GenAI add-on",
    ably: "AI Transport (network)",
    pusher: "No",
    fluxy: "invokeAgent writes chat messages",
  },
  {
    label: "Polls / anonymous ballots",
    portal: "You build on ephemeral + extension",
    stream: "Varies",
    ably: "DIY",
    pusher: "DIY",
    fluxy: "createPoll / votePoll + POST /polls isAnonymous",
  },
  {
    label: "HTTP device ingest",
    portal: "HTTP publish, no IoT schema",
    stream: "No",
    ably: "MQTT / IoT messaging",
    pusher: "No",
    fluxy: "POST → iot.reading / fleet.gps_update. iotAutoAgentId can invoke without @mention",
  },
  {
    label: "Config without forking the server",
    portal: "portal.config.ts + portal deploy",
    stream: "Dashboard rules",
    ably: "Capabilities",
    pusher: "Channel rules",
    fluxy: "fluxy.config.ts + pnpm fluxy:deploy (rooms, deny, extension slots). Callbacks on self-host",
  },
  {
    label: "Inbox realtime socket",
    portal: "wss://realtime.useportal.co/inbox",
    stream: "Notification feeds",
    ably: "Push / channels",
    pusher: "User channels / Beams",
    fluxy: "GET /ws/inbox (connectInbox). Same User DO as /ws/user/:id; inbox_updated only",
  },
  {
    label: "Nested chat threads",
    portal: "threadParentId lens, registry + opaque cursor, inbox siblings",
    stream: "Channel threads",
    ably: "DIY",
    pusher: "DIY",
    fluxy: "parentId lens (useThread), GET /rooms/:id/threads + nextCursor, inbox kind thread",
  },
  {
    label: "Room / channel extension snapshots",
    portal: "channel.ext + ctx.storage, max 5",
    stream: "Custom",
    ably: "Channel state",
    pusher: "No",
    fluxy: "GET/PUT /rooms/:id/extensions (kv|counter, max 5, 16 KiB). Hosted: declared kinds, no eval",
  },
  {
    label: "Time to first public message",
    portal: "new Portal({ apiKey: pk_ })",
    stream: "Dashboard + user tokens",
    ably: "SDK + keys",
    pusher: "SDK + keys",
    fluxy: "FluxyRealtimeProvider + publishableKey + useChat({ roomId })",
  },
  {
    label: "Voice / live video media",
    portal: "Reserved in v1. Bring an SFU",
    stream: "Separate Video SKU",
    ably: "No SFU",
    pusher: "No",
    fluxy: "joinVoiceStage signaling. Media is LiveKit. Not an SFU",
  },
  {
    label: "Hosted maturity",
    portal: "Price unpublished. Cloud lock-in",
    stream: "SLA on paid tiers",
    ably: "Enterprise SLA / HIPAA BAA",
    pusher: "Enterprise-select SLA",
    fluxy: "Open beta. Pin npm. Written SLA only with a signed MSA",
  },
] as const;

export const COMPARE_LABS_NOTE =
  "MCP, WorkflowAgent, FCM, spatial twins, PITR UI, and Bridges OAuth are not this table. Kernel first.";

export interface AlternativeApproach {
  name: string;
  bestFor: string;
  tradeoff: string;
  fluxyAngle: string;
}

/** Cloudflare-adjacent or DIY stacks buyers compare mentally. */
export const ALTERNATIVE_APPROACHES: readonly AlternativeApproach[] = [
  {
    name: "Cloudflare Agents SDK (npm i agents)",
    bestFor:
      "A single-agent Durable Object: SQL memory, hibernation, MCP SDK v2, Think/chat loops on Workers.",
    tradeoff:
      "An agent OS, not a multi-tenant room product. You still build JWT tenancy, billing, presence, history, and an operator console.",
    fluxyAngle:
      "FluxyChat is the room kernel: humans and agents share one timeline, Bridges in the console, and MIT self-host. Keep Agents SDK for an Agent class Worker; pick FluxyChat when the product is a room.",
  },
  {
    name: "Hosted chat SDK (proprietary)",
    bestFor: "Teams optimizing for React DX, SSR-safe hooks, inbox feed, streaming agents, hosted dashboard.",
    tradeoff: "Proprietary hosted service, no MIT self-host on your Cloudflare account; broader platform modules (stream, IoT, fleet) are on you.",
    fluxyAngle: "FluxyChat matches inbox/useInbox, connection UX, and AI timeline, plus MIT self-host and Workers/DO-native rooms. Bridges are console rows you wire (you create the vendor app).",
  },
  {
    name: "PartyKit (+ DO demos on X)",
    bestFor: "Collab sessions, games, generic realtime “party” state, often mentioned beside Durable Objects in builder posts.",
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
    tradeoff: "Realtime chat is one module among many, scope blur.",
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
    tradeoff: "You own connection lifecycle, scaling, auth, and ops, easy to underestimate.",
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
    tradeoff: "GPL-3.0; not a headless API, you adopt their product shape or fork the monolith.",
    fluxyAngle: "FluxyChat is MIT chat infrastructure: room-per-DO, D1, SDK, operator console, embed in your SaaS without their UI.",
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
    fluxyAngle: "FluxyChat is infrastructure for your app’s messaging, pair with your own support UI if needed.",
  },
  {
    name: "Node-RED WebSocket nodes",
    bestFor: "Teams that already orchestrate telco/CRM/call-center logic in flows they operate.",
    tradeoff: "You own socket reliability, scaling, and upgrades on your Node-RED runtime, not edge room isolation.",
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
    q: "We deploy on Vercel, can’t we use Vercel WebSockets?",
    a: "Many teams hit WebSocket limits, pricing, or ops friction on serverless hosts. A common pattern is Vercel/Netlify for the UI and FluxyChat on Cloudflare for room state, no second Pusher bill, no VPS socket fleet.",
  },
  {
    q: "Do I still need a separate WebSocket vendor?",
    a: "Not for in-app chat, collab, game, or IoT on Cloudflare: FluxyChat uses Workers + one Durable Object per room. You may still want telco APIs for SMS/WhatsApp or a dedicated SFU for large video rooms.",
  },
  {
    q: "What about idle rooms and surprise Cloudflare bills?",
    a: "Room-scoped DOs limit blast radius vs one global socket server. You still need budget alerts, staging tests, and avoiding unbounded write loops into storage, see cost guardrails on /why.",
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
    a: "Great for learning. For SaaS in-app chat, compare the DIY checklist on this page, FluxyChat ships the same Room DO pattern plus JWT, history, reconnect SDK, and console.",
  },
  {
    q: "Shared state for humans and AI agents in one room?",
    a: "FluxyChat streams agent tool events on the same WebSocket as user messages, useful for copilots and agentic SaaS. See /guides/durable-objects-for-chat-rooms.",
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
    fluxy: "RoomDurableObject in MIT repo, same pattern, maintained",
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

export const PUSHER_ALTERNATIVE_ANSWER = {
  title: "Is FluxyChat a Pusher alternative?",
  body: "If the product is tenant rooms on Cloudflare, usually yes: history in D1, reconnect, a console. If you only need pub/sub, keep Pusher or Ably. SMS or WhatsApp to phones still needs a telco. Hosted is beta. Self-host is MIT on your Cloudflare account.",
} as const;

export const PUSHER_BILL_SHOCK = {
  title: "When the Pusher bill catches up",
  intro:
    "Same story in every thread: the free tier is fine for a demo, then connection and message pricing climbs faster than the app. FluxyChat is not a flat-fee miracle, you still pay Cloudflare, but you can self-host on your account, read the MIT source, and drop a second vendor's connection counter.",
  bullets: [
    "Try hosted beta first; self-host when pricing starts to matter in the evaluation.",
    "One Durable Object per room keeps cost and failure scoped to that room, not one global socket server.",
    "D1 history and REST pagination instead of cache-only channel events you stitch back together.",
    "Same SDK for hosted and self-host, swap Worker URL and keys, not your client code.",
  ],
} as const;

export const SELF_HOST_POSITIONING = {
  title: "Self-host on your Cloudflare account",
  intro:
    "Can we run it ourselves? Yes. That is the product, not a footnote. Deploy the Worker on your Cloudflare account, keep D1, keep the MIT source, keep the same SDK you used on hosted.",
  bullets: [
    "Deploy apps/worker and run D1 migrations on your Cloudflare account (MIT monorepo).",
    "Same console and @fluxy-chat/sdk as hosted beta; you wire Clerk and Stripe if you want them.",
    "JWT tenants, webhooks, GDPR export, and message middleware all run on your Worker.",
  ],
} as const;

export const BUILD_VS_BUY = {
  title: "Build vs buy",
  intro:
    "Socket.IO on a VM is you on call. Pusher and Ably sell connections. FluxyChat sells the room: chat, presence, Yjs, agents, HTTP ingest, console, MIT source. Same SDK hosted or on your Cloudflare account.",
  bullets: [
    "DIY Socket.IO: reconnect, history, multi-tenant JWT, and paging are your problem.",
    "Pusher / Ably / Stream: fast transport, then extra SKUs for video, push, and AI.",
    "FluxyChat: one room Durable Object plus D1. Drop Ably when you need more than pub/sub. Keep Liveblocks if the artifact is only a document.",
  ],
} as const;

/** SDK gzip benchmarks, from `pnpm run check:bundle-size` (artifact sizes; apps tree-shake further). */
export const SDK_BUNDLE_BENCHMARKS = [
  {
    package: "@fluxy-chat/react",
    gzipKb: 0.3,
    budgetKb: 20,
    note: "Chat-only React hooks entry",
  },
  {
    package: "@fluxy-chat/sdk/react",
    gzipKb: 0.4,
    budgetKb: 20,
    note: "Transitional react subpath",
  },
  {
    package: "@fluxy-chat/sdk",
    gzipKb: 18.3,
    budgetKb: 160,
    note: "Full client (import only what you need)",
  },
  {
    package: "Typical hosted chat SDK (reference)",
    gzipKb: 14,
    budgetKb: null,
    note: "Industry reference for chat-only tree-shaken apps",
  },
] as const;

/** Internal product excellence tracker, see docs/PORTAL-ZERO-BUDGET-ROADMAP.md */
export const PRODUCT_EXCELLENCE_TRACKER = [
  { id: "PG-ZB-1", phase: "DX", label: "create-fluxy-chat React template (60s first message)", status: "done" as const },
  { id: "PG-ZB-2", phase: "DX", label: "Public bundle benchmark table", status: "done" as const },
  { id: "PG-ZB-3", phase: "DX", label: "Deploy to Cloudflare one-click", status: "done" as const },
  { id: "PG-ZB-4", phase: "Docs", label: "Feature parity checklist", status: "done" as const },
  { id: "PG-ZB-5", phase: "DX", label: "Inbox demo video in README", status: "done" as const },
  { id: "PG-ZB-6", phase: "MCP", label: "Official MCP server examples (clone & run)", status: "done" as const },
  { id: "PG-ZB-7", phase: "MCP", label: "mcp-audit CI + marketplace badge", status: "done" as const },
  { id: "PG-ZB-8", phase: "UI", label: "@fluxy-chat/ui starter themes (4 presets)", status: "done" as const },
  { id: "PG-ZB-9", phase: "Docs", label: "Chat-only docs nav slice", status: "done" as const },
  { id: "PG-ZB-10", phase: "Voice", label: "LiveKit self-hosted voice pipeline", status: "done" as const },
  { id: "PG-ZB-11", phase: "CRM", label: "Activepieces embed for helpdesk flows", status: "done" as const },
  { id: "PG-ZB-12", phase: "Mobile", label: "Kotlin/Swift/Flutter in-repo (not Maven/pub.dev hosted path)", status: "done" as const },
  { id: "PG-COMP-1", phase: "UI", label: "@fluxy-chat/ui-kit drop-in widget + inbox", status: "done" as const },
  { id: "PG-COMP-2", phase: "DX", label: "create-fluxy-chat --minimal chat-only scaffold", status: "done" as const },
  { id: "PG-COMP-3", phase: "Mobile", label: "KMP Maven Central + iOS XCFramework — not published; SDKs are in-repo", status: "done" as const },
  { id: "PG-COMP-4", phase: "Voice", label: "LiveKit load-test scripts + report template", status: "done" as const },
  { id: "PG-COMP-5", phase: "MCP", label: "MCP verified servers page + audit badge", status: "done" as const },
  { id: "PG-COMP-6", phase: "Docs", label: "Competitive strategy + production setup guides", status: "done" as const },
] as const;

export type ProductExcellenceStatus = (typeof PRODUCT_EXCELLENCE_TRACKER)[number]["status"];

/** @deprecated Use PRODUCT_EXCELLENCE_TRACKER for public-facing copy */
export const PORTAL_GAP_CLOSURE = [
  { id: "PG-P0-1", phase: "P0", label: "React bundle ≤20 kB gzip (CI gate)", status: "done" as const },
  { id: "PG-P0-2", phase: "P0", label: "Chat-only quickstart (Portal 3-step path)", status: "done" as const },
  { id: "PG-P0-3", phase: "P0", label: "Compare page gap tracker", status: "done" as const },
  { id: "PG-P0-4", phase: "P0", label: "Migrate from Portal guide", status: "done" as const },
  { id: "PG-P0-5", phase: "P0", label: "Inbox UX parity (onItem, catch-up, mark-read, badge)", status: "done" as const },
  { id: "PG-P0-6", phase: "P0", label: "Portal-parity E2E smoke + integrated", status: "done" as const },
  { id: "PG-P0-7", phase: "P0", label: "Tree-shaken bundle measurement docs (Vite)", status: "done" as const },
  { id: "PG-P1-1", phase: "P1", label: "Embed widget polish (mobile, streaming agent bubble)", status: "done" as const },
  { id: "PG-P1-2", phase: "P1", label: "@fluxy-chat/ui npm + Storybook", status: "done" as const },
  { id: "PG-P1-3", phase: "P1", label: "Hosted zero-ops onboarding wizard", status: "done" as const },
  { id: "PG-P1-4", phase: "P1", label: "Chat-only landing slice on /get-started", status: "done" as const },
  { id: "PG-P1-5", phase: "P1", label: "Agent reply without speaker prefix + scroll stick-bottom", status: "done" as const },
  { id: "PG-P1-6", phase: "P1", label: "Streaming edit protocol (edit inbound)", status: "done" as const },
  { id: "PG-P2-1", phase: "P2", label: "Voice AI pipeline <300ms (MO-9.1)", status: "done" as const },
  { id: "PG-P2-2", phase: "P2", label: "Huddles A/V + screen share (MO-9.2)", status: "done" as const },
  { id: "PG-P2-3", phase: "P2", label: "Cross-channel customer memory UI (MO-9.3)", status: "done" as const },
  { id: "PG-P2-4", phase: "P2", label: "MCP Apps marketplace curated (MO-12.1)", status: "done" as const },
  { id: "PG-P2-5", phase: "P2", label: "CRM native (Zendesk/HubSpot/Intercom/SF)", status: "done" as const },
  { id: "PG-P3-1", phase: "P3", label: "Kotlin Android SDK (MD-5)", status: "done" as const },
  { id: "PG-P3-2", phase: "P3", label: "Swift iOS SDK (MD-5)", status: "done" as const },
  { id: "PG-P4-1", phase: "P4", label: "SOC 2 Type 2 signed audit", status: "deferred" as const },
  { id: "PG-P4-2", phase: "P4", label: "HIPAA BAA legal template", status: "deferred" as const },
] as const;

export type PortalGapStatus = (typeof PORTAL_GAP_CLOSURE)[number]["status"];

export const PRODUCT_CHAT_VS_SUPPORT = {
  title: "In-app realtime platform, not a support desk",
  intro:
    "Most live-chat listicles are written for support teams: inbox, macros, CSAT. FluxyChat is for realtime inside your product: tenant rooms, an SDK embed, and agent events on the same timeline. Wire Salesforce or HubSpot through your own integration layer. We handle the room kernel.",
  bullets: [
    "Helpdesk products sell ticketing and agent assignment. We sell transport, history, JWT rooms, platform modules, and webhooks.",
    "User messages and agent tool_call / tool_result share the room timeline, so you can replay what happened.",
    "Stream, collab, game, IoT, and fleet modules reuse the same Worker, not a patchwork of vendor SKUs.",
  ],
} as const;

export const PUSHER_ON_VERCEL = {
  title: "FluxyChat vs Pusher on Vercel",
  intro:
    "Vercel documents Pusher as a common path for live features. FluxyChat keeps the socket layer on Cloudflare so you avoid a second vendor SKU and room limits on serverless functions.",
  bullets: [
    "Keep Next.js on Vercel. Point @fluxy-chat/sdk at your Worker URL. Public rooms can join as guest.",
    "Mint member JWTs in a Route Handler, no Pusher app keys in the browser.",
    "Map old channel names to roomIds; use REST + D1 for history instead of cache-only events.",
    "Self-host the Worker on your CF account when you need cost governance and opaque-socket-bill control.",
  ],
} as const;

export const ABLY_ON_VERCEL = {
  title: "FluxyChat vs Ably for in-app chat on Vercel",
  intro:
    "Ably Next.js starters own search for realtime chat on Vercel. FluxyChat is the room layer on Cloudflare Workers plus Durable Objects. Keep Ably if you only need generic pub/sub. Tenant rooms, history, and the operator console stay in FluxyChat.",
  bullets: [
    "Same split: Vercel for SSR/UI, Worker for WebSockets.",
    "Room-per-DO ordering and D1 history, not only channel events.",
    "Agent tool events on the room stream for copilot products.",
    "MIT self-host when lock-in and per-connection bills are the objection.",
  ],
} as const;

export const DECISION_FLOW = [
  {
    question: "Need SMS/WhatsApp to phones?",
    yes: "Use a telco API (e.g. Sent) alongside FluxyChat for in-app threads.",
    no: "Keep going.",
  },
  {
    question: "Need collab/game party realtime (PartyKit-style), not product chat?",
    yes: "Consider PartyKit or generic edge realtime tooling.",
    no: "Keep going.",
  },
  {
    question: "Frontend on Vercel/Netlify, need realtime without a socket VPS?",
    yes: "FluxyChat on Cloudflare + your existing frontend host.",
    no: "Keep going.",
  },
  {
    question: "Need only pub/sub fan-out (no message history UI)?",
    yes: "Consider Ably/Pusher-style channels.",
    no: "FluxyChat: rooms, history, presence, agents, collab, game, IoT.",
  },
  {
    question: "Must run on your Cloudflare account?",
    yes: "MIT self-host FluxyChat.",
    no: "Try hosted beta or self-host, same API shape.",
  },
] as const;

/** Portal hackathon patterns: room as OS for humans + agents (PH-*). */
export const HACKATHON_ROOM_OS_LINKS = [
  {
    id: "PH-100",
    label: "Room as MCP server",
    href: "https://docs.fluxychat.com/docs/guides/room-as-mcp-server",
    console: "/rooms",
  },
  {
    id: "PH-103",
    label: "Cross-org agent negotiation",
    href: "https://docs.fluxychat.com/docs/guides/cross-org-negotiation",
    console: "/agents/cross-org",
  },
  {
    id: "PH-110",
    label: "Critical action quorum",
    href: "https://docs.fluxychat.com/docs/guides/critical-action-quorum",
    console: "/rooms",
  },
  {
    id: "PH-111",
    label: "External event ingest",
    href: "https://docs.fluxychat.com/docs/guides/external-event-ingest",
    console: "/rooms",
  },
  {
    id: "PH-112",
    label: "Audience score rollup",
    href: "https://docs.fluxychat.com/docs/guides/audience-score",
    console: "/rooms",
  },
  {
    id: "PH-113",
    label: "Asymmetric session profiles",
    href: "https://docs.fluxychat.com/docs/guides/asymmetric-sessions",
    console: "/rooms",
  },
  {
    id: "PH-130",
    label: "Live knowledge graph",
    href: "https://docs.fluxychat.com/docs/guides/live-knowledge-graph",
    console: "/rooms",
  },
] as const;

