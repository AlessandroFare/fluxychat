/**
 * Long-form positioning for /why — written for developers evaluating Fluxychat.
 */

export const WHY_THESIS =
  "Shipping a REST route on Vercel or Netlify is usually quick. WebSockets still tend to send you elsewhere: another vendor, another stack, or someone on the team who knows socket ops.";

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
      "Most modern hosts make HTTP easy. Stateful WebSockets are still awkward on the same platform, and the managed realtime products that fill the gap often come with sales calls, stiff pricing, or a push to move your database over to them.",
      "I built Fluxychat because I wanted chat to deploy like the rest of my stack: application code on a Worker, rooms without running a separate socket cluster.",
      "This is open beta. I work on it solo. I'd rather hear what's confusing in onboarding than get a long feature list.",
    ],
  },
  {
    id: "stack",
    title: "Why Workers + Durable Objects + D1",
    paragraphs: [
      "Rooms need sticky state. Durable Objects handle presence, typing, and fan-out per room.",
      "Cloudflare documents that a single Durable Object can serve many concurrent WebSocket clients; FluxyChat uses one Room object per room so load and billing stay room-scoped instead of one global socket fleet.",
      "Messages and metadata sit in D1 so you keep queryable history without handing everything to a third-party BaaS.",
      "The same Worker serves HTTP (JWT mint, REST writes, webhooks, GDPR export) and upgrades to WebSockets. One deploy surface, Cloudflare billing you can read.",
      "If you already run APIs or static apps on Cloudflare, chat can live on that account instead of adding Pusher, Ably, or another region somewhere else.",
      "Cloudflare’s own docs vocabulary — coordination, shared state, chat rooms, WebSocket hibernation — is the same story FluxyChat implements with one Room Durable Object per channel.",
    ],
  },
  {
    id: "operator",
    title: "Operator console (hosted beta)",
    bullets: [
      "Projects, API keys, and member JWT minting without exposing secrets in the browser.",
      "Rooms list, templates, webhooks, and agent hooks from the dashboard.",
      "Billing and quota hooks wired to the Worker so message and agent limits enforce in one place.",
      "Self-hosters get the same MIT dashboard and Worker; you wire Clerk, Stripe, and secrets yourself.",
    ],
  },
  {
    id: "hosted",
    title: "Hosted cloud vs self-host",
    paragraphs: [
      "Hosted cloud: sign up, run the quickstart wizard, and you get a project, member JWT, room, and first message in a few minutes. Clerk handles auth. The console covers rooms, agents, webhooks, and billing hooks.",
      "Self-host: clone the MIT monorepo, deploy apps/worker to your Cloudflare account, run D1 migrations, and point @fluxy-chat/sdk at your Worker URL. You own secrets, upgrades, and where data lives.",
      "Same codebase either way. Hosted saves setup time. Self-host gives you the keys. Both let you read the code.",
    ],
  },
  {
    id: "vercel",
    title: "Vercel / Netlify front, Cloudflare chat",
    paragraphs: [
      "REST on Vercel is easy; long-lived WebSockets often are not — limits, pricing, and workarounds (managed Vercel WebSocket products or DIY functions) show up in every builder thread.",
      "FluxyChat keeps your Next.js or Nuxt app where it is and runs room WebSockets on Workers + one Durable Object per room. You skip a separate Pusher/Ably line item and avoid running your own socket VPS.",
      "See /guides/cloudflare-workers-chat for the step-by-step mental model after Cloudflare’s official chat demo.",
    ],
  },
  {
    id: "not",
    title: "What we are not",
    bullets: [
      "A full backend replacement. Chat is the product, not your entire data layer.",
      "A helpdesk or Intercom replacement (Libredesk-style stacks are a different buy). FluxyChat is the chat infrastructure for your SaaS UI.",
      "Enterprise SLA territory yet. Beta means rough edges.",
      "A drop-in TalkJS-style UI kit. You bring components; we ship SDK hooks, transport, and operator tools.",
      "An \"AI-first\" pitch. Agents are optional. Humans and bots use the same rooms.",
      "Closed source. Worker, dashboard, and SDK are MIT in the repo.",
    ],
  },
  {
    id: "compare",
    title: "How to think about alternatives",
    paragraphs: [
      "Stream and TalkJS get you to polished chat UI fast. Fluxychat is for people who want messages on their Worker, readable source, and a hosted trial that can become self-host without rewriting transport.",
      "PartyKit and generic edge realtime tools excel at collab sessions and custom party state — not tenant-scoped chat with history, templates, and operator tooling. See the comparison table on /compare.",
      "Supabase Realtime and Convex bundle realtime with their database. Fluxychat does not ask you to migrate Postgres. You deploy Worker + D1, or use our hosted stack.",
      "Pusher and Ably are strong managed channels at scale. Fluxychat fits if you'd rather pay Cloudflare and own the schema, or try hosted first and fork when you need to.",
      "Workers + Upstash Redis DIY is valid if you want to build every piece. Fluxychat is the pre-wired chat layer (room DO, D1, SDK, reconnect semantics).",
      "Vercel WebSocket workarounds and Ably’s Next.js tutorials solve adjacent problems; FluxyChat targets in-app chat on Cloudflare with room-per-DO scaling — see /compare.",
    ],
  },
  {
    id: "cost",
    title: "Cost philosophy and guardrails",
    paragraphs: [
      "At this stage I prefer edge pricing and explicit quotas over opaque per-connection enterprise deals.",
      "Plans and billing hooks live in the console. The Worker enforces quotas on messages and agent invokes.",
      "Self-hosters pay Cloudflare directly. Hosted users start on a free tier and upgrade when limits show up. No sales call required to try it.",
    ],
    bullets: [
      "Set Cloudflare budget alerts and test in staging before production traffic.",
      "Avoid hot loops that write to D1 on every keystroke; use DO state for ephemeral signals (typing) and batch persistence where it makes sense.",
      "Room-scoped Durable Objects limit blast radius vs one monolithic socket server — idle rooms still cost something; monitor and archive old rooms.",
      "Read Cloudflare’s DO and D1 pricing pages when sizing; FluxyChat does not hide CF usage behind a flat “connections” SKU.",
    ],
  },
  {
    id: "architecture",
    title: "Architecture in one pass",
    paragraphs: [
      "Browser or server SDK → Worker (HTTP + WebSocket) → Durable Object per room for live state → D1 for messages, projects, and webhooks. Admin JWTs mint member tokens server-side so API keys stay off the client. An optional agent worker handles mentions via webhooks and posts replies into the same room stream.",
    ],
  },
] as const satisfies readonly WhySection[];

export const WHY_FAQ = [
  {
    q: "Is this production-ready?",
    a: "Open beta. Rooms, messages, onboarding, and GDPR export work in my testing, but run your own load and compliance review before you treat it as GA.",
  },
  {
    q: "Why open source if you charge for hosted?",
    a: "The MIT repo is for people who want to read and self-host. Hosted cloud charges for setup you'd otherwise do yourself: auth, provisioning, console, billing wiring.",
  },
  {
    q: "Can I use this without Cloudflare?",
    a: "Not today. The reference stack is Workers, Durable Objects, and D1. Porting would mean replacing all three.",
  },
  {
    q: "Where do I start?",
    a: "Hosted: sign up and open /onboarding. Self-host: docs and apps/worker in the GitHub repo. SDK: pnpm add @fluxy-chat/sdk.",
  },
  {
    q: "How is this different from PartyKit or a full Cloudflare starter framework?",
    a: "PartyKit targets generic edge realtime parties; full frameworks bundle auth, storage, and AI. FluxyChat is only the chat slice: rooms, history, SDK, and operator tools on Workers + D1.",
  },
  {
    q: "Will I get a surprise bill from Durable Objects?",
    a: "Any edge stack can spike if you write unbounded data or leave abusive loops running. Use CF budget alerts, quotas in the console, and the guardrails above. Compare approaches at /compare.",
  },
  {
    q: "We use Vercel — do we need Pusher or Ably?",
    a: "Only if you want a general realtime bus. For tenant-scoped in-app chat, many teams pair Vercel/Netlify with FluxyChat on Cloudflare instead of a second socket vendor or a DIY WebSocket fleet on Functions.",
  },
  {
    q: "Are Durable Objects too slow or single-threaded for chat?",
    a: "Each room is one DO — sequential processing is usually fine for ordering. Ultra-hot single channels may need sharding; see /guides/durable-objects-chat-tradeoffs.",
  },
  {
    q: "Will idle WebSockets bankrupt me on Cloudflare?",
    a: "Hibernation helps; cost spikes usually come from unbounded writes or one hot loop. See /guides/durable-objects-hibernation-cost.",
  },
] as const;

export const WHY_CTA = {
  title: "Try the open beta",
  body: "Quickstart wizard, SDK on npm, MIT repo on GitHub. Tell me what breaks.",
} as const;
