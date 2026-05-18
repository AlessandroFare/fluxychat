/**
 * Long-form positioning for /why — infra-minded developers evaluating Fluxychat.
 */

export const WHY_THESIS =
  "REST became trivial on serverless. Realtime still pushes you toward another vendor, another stack, or another ops burden.";

export interface WhySection {
  id: string;
  title: string;
  paragraphs?: readonly string[];
  bullets?: readonly string[];
}

export const WHY_SECTIONS: readonly WhySection[] = [
  {
    id: "exists",
    title: "Why Fluxychat exists",
    paragraphs: [
      "Deploying a REST route on Vercel, Netlify, or similar is often one file and a git push. Stateful WebSockets on the same platform are still awkward: many hosts do not offer first-class WebSocket backends, and the managed realtime vendors that do often come with sales friction, high touch pricing, or a requirement to move your whole database.",
      "Fluxychat is my attempt to make edge-native chat feel closer to the serverless contract: write application logic, deploy to Cloudflare Workers, get bidirectional rooms without running a separate socket cluster.",
      "It is open beta. I am the solo builder. Feedback on onboarding and SDK ergonomics is more valuable than feature requests right now.",
    ],
  },
  {
    id: "stack",
    title: "Why Workers + Durable Objects + D1",
    paragraphs: [
      "WebSocket rooms need sticky, stateful coordination — Durable Objects handle presence, typing, and fan-out per room.",
      "Messages and metadata live in D1 (SQLite at the edge) so you keep queryable history without shipping everything to a third-party BaaS.",
      "The same Worker serves HTTP (JWT mint, REST writes, webhooks, GDPR export) and upgrades to WebSockets. One deployment surface, predictable Cloudflare billing.",
      "If you already standardize on Cloudflare for APIs or static apps, chat can live on the same account instead of introducing Pusher, Ably, or a second region.",
    ],
  },
  {
    id: "hosted",
    title: "Hosted cloud vs self-host",
    paragraphs: [
      "Hosted cloud: sign up, run the quickstart wizard, get a provisioned project, member JWT, room, and first message in minutes. Clerk handles auth; the console covers rooms, agents, webhooks, and billing hooks.",
      "Self-host: clone the MIT monorepo, deploy apps/worker to your Cloudflare account, run D1 migrations, and point @fluxy-chat/sdk at your Worker URL. You own secrets, upgrades, and data residency.",
      "Same codebase for both paths. Hosted is convenience; self-host is control. Neither requires you to trust a black box you cannot inspect.",
    ],
  },
  {
    id: "not",
    title: "What we are not",
    bullets: [
      "Not a Firebase or Supabase replacement — chat is the wedge, not your entire backend.",
      "Not enterprise-grade SLA yet — open beta with honest gaps.",
      "Not a drop-in TalkJS UI kit — you bring components; we provide SDK hooks, transport, and operator tools.",
      "Not \"AI-first\" marketing — agents are optional; humans and bots share the same room model.",
      "Not closed source — the Worker, dashboard, and SDK are in the repo under MIT.",
    ],
  },
  {
    id: "compare",
    title: "How to think about alternatives",
    paragraphs: [
      "Stream, TalkJS, and similar products optimize for speed-to-UI and mature SDKs. Fluxychat optimizes for developers who want data on their Worker, MIT source, and a path from hosted trial to self-host without rewriting.",
      "Supabase Realtime and Convex bundle realtime with their database. Fluxychat does not ask you to migrate Postgres — only to deploy (or use) a Worker + D1 stack you can read.",
      "Pusher and Ably excel at managed channels at scale. Fluxychat targets teams that would rather pay Cloudflare edge units and own the schema, or start on hosted cloud and fork later.",
    ],
  },
  {
    id: "cost",
    title: "Cost philosophy",
    paragraphs: [
      "Edge pricing plus explicit quotas beats opaque per-connection enterprise contracts for early-stage products.",
      "The console exposes billing hooks and plan tiers; the Worker enforces quotas on messages and agent invokes.",
      "Self-hosters pay Cloudflare directly. Hosted users start on a free tier and upgrade when quotas bite — no sales call required to try it.",
    ],
  },
  {
    id: "architecture",
    title: "Architecture (one paragraph)",
    paragraphs: [
      "Browser or server SDK → Worker HTTP + WebSocket → Durable Object per room (live state) → D1 (messages, projects, webhooks). Admin JWTs mint member tokens server-side; API keys never ship to the client. Optional AI agent service processes mentions via webhooks and posts replies into the same room stream.",
    ],
  },
] as const satisfies readonly WhySection[];

export const WHY_FAQ = [
  {
    q: "Is this production-ready?",
    a: "Open beta. Core paths (rooms, messages, onboarding, GDPR export) are tested, but I would run your own load and compliance review before calling it GA.",
  },
  {
    q: "Why open source if you charge for hosted?",
    a: "MIT code builds trust and enables self-hosters. Paid hosted cloud saves setup time — auth, provisioning, console, billing hooks. Same model as many dev tools.",
  },
  {
    q: "Can I use this without Cloudflare?",
    a: "The reference implementation is Cloudflare-native. Porting would mean replacing Workers, DO, and D1 — not a supported path today.",
  },
  {
    q: "Where do I start?",
    a: "Hosted: sign up and run /onboarding. Self-host: docs and apps/worker in the GitHub repo. SDK: pnpm add @fluxy-chat/sdk.",
  },
] as const;
