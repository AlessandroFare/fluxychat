import type { GuideContent } from "@/lib/guides/types";
import { CF_REALTIME_CHAT_TUTORIAL, CF_WORKERS_CHAT_DEMO } from "@/lib/marketing-links";

export const AFTER_CF_CHAT_TUTORIAL_GUIDE: GuideContent = {
  title: "After Cloudflare’s real-time chat tutorial",
  subtitle:
    "You finished the official Workers + Durable Objects walkthrough — here is what production SaaS chat still needs, and how FluxyChat packages it.",
  sections: [
    {
      title: "What the tutorial proves",
      paragraphs: [
        "Cloudflare’s real-time chat application tutorial validates the core pattern: WebSocket upgrade on a Worker, shared state in a Durable Object, fan-out to clients in a room.",
        "That is the right mental model. It is not yet multi-tenant auth, billing, operator tooling, or client reconnect semantics.",
      ],
      link: CF_REALTIME_CHAT_TUTORIAL,
    },
    {
      title: "What teams add next (the long tail)",
      bullets: [
        "Project-scoped JWT and room membership — not open rooms.",
        "D1 (or equivalent) for history, search, and export — not memory-only fan-out.",
        "Reconnect, loadMore, and delivery status on the client.",
        "Quotas, webhooks, GDPR flows, and an operator console.",
        "Agent tool_call / tool_result on the same timeline as user messages.",
      ],
      link: CF_WORKERS_CHAT_DEMO,
    },
    {
      title: "FluxyChat as the production layer",
      bullets: [
        "One RoomDurableObject per room — same architecture as the tutorial, maintained in MIT source.",
        "Self-host on your Cloudflare account or try hosted beta — no second socket vendor.",
        "@fluxy-chat/sdk for React/Next.js; vanilla store for other stacks.",
        "Dashboard for projects, rooms, agents, and billing hooks.",
      ],
    },
    {
      title: "Astro, Nuxt, or Vercel front",
      paragraphs: [
        "Keep your UI on Pages, Astro, or Vercel. Point the SDK at your Worker URL. You get edge chat without rebuilding the tutorial boilerplate on every feature.",
      ],
    },
  ],
  seoTopics: [
    "real-time chat application on cloudflare workers",
    "durable objects chat tutorial",
    "cloudflare workers websocket",
    "production chat cloudflare",
  ],
};
