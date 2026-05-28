import type { GuideContent } from "@/lib/guides/types";
import {
  CF_DO_RULES,
  CF_WORKERS_CHAT_DEMO,
  DEVTO_SOCKET_FLEET_ARTICLE,
} from "@/lib/marketing-links";

export const CF_WORKERS_CHAT_GUIDE: GuideContent = {
  title: "How to build instant messaging on Cloudflare Workers",
  subtitle:
    "cloudflare workers websocket + durable objects chat — shared state coordination per room, D1 history, realtime without a VPS. For Cloudflare Pages, Vercel, or Netlify fronts.",
  sections: [
    {
      title: "Start with Cloudflare’s chat demo (mental model)",
      paragraphs: [
        "The official Workers WebSocket chat example shows: Worker upgrade → one Durable Object per room → fan-out to connected clients. Treat it as hello-world, not multi-tenant production.",
      ],
      link: CF_WORKERS_CHAT_DEMO,
    },
    {
      title: "Use Cloudflare’s vocabulary",
      paragraphs: [
        "Buyers researching DOs see the same phrases in official docs: coordination, shared state, chat rooms, WebSocket hibernation, transactional consistency. FluxyChat is the production chat layer built on those primitives.",
      ],
      link: CF_DO_RULES,
    },
    {
      title: "Understand what production adds",
      bullets: [
        "JWT auth per tenant and room membership checks in D1.",
        "History pagination and reconnect/backoff on the client.",
        "Quotas, webhooks, GDPR export, operator console.",
        "Human + agent events on the same room WebSocket.",
      ],
    },
    {
      title: "Pick your deploy split",
      paragraphs: [
        "Next.js or Nuxt on Vercel/Netlify for HTTP + UI; FluxyChat Worker on Cloudflare for chat. Avoid Vercel WebSocket limits and a second Pusher/Ably vendor.",
      ],
    },
    {
      title: "Go deeper with a walkthrough",
      paragraphs: [
        "Worker routing at `/ws/room/:roomId`, RoomDurableObject, SDK useChat, and self-host commands — in the long-form Dev.to article.",
      ],
      link: DEVTO_SOCKET_FLEET_ARTICLE,
    },
  ],
  seoTopics: [
    "cloudflare workers websocket",
    "durable objects chat",
    "shared state coordination",
    "pusher alternative",
    "realtime without vps",
    "vercel websocket limits",
    "ably alternative next.js",
  ],
};
