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
      "Messages and metadata sit in D1 so you keep queryable history without handing everything to a third-party BaaS.",
      "The same Worker serves HTTP (JWT mint, REST writes, webhooks, GDPR export) and upgrades to WebSockets. One deploy surface, Cloudflare billing you can read.",
      "If you already run APIs or static apps on Cloudflare, chat can live on that account instead of adding Pusher, Ably, or another region somewhere else.",
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
    id: "not",
    title: "What we are not",
    bullets: [
      "A full backend replacement. Chat is the product, not your entire data layer.",
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
      "Supabase Realtime and Convex bundle realtime with their database. Fluxychat does not ask you to migrate Postgres. You deploy Worker + D1, or use our hosted stack.",
      "Pusher and Ably are strong managed channels at scale. Fluxychat fits if you'd rather pay Cloudflare and own the schema, or try hosted first and fork when you need to.",
    ],
  },
  {
    id: "cost",
    title: "Cost philosophy",
    paragraphs: [
      "At this stage I prefer edge pricing and explicit quotas over opaque per-connection enterprise deals.",
      "Plans and billing hooks live in the console. The Worker enforces quotas on messages and agent invokes.",
      "Self-hosters pay Cloudflare directly. Hosted users start on a free tier and upgrade when limits show up. No sales call required to try it.",
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
] as const;

export const WHY_CTA = {
  title: "Try the open beta",
  body: "Quickstart wizard, SDK on npm, MIT repo on GitHub. Tell me what breaks.",
} as const;
