import type { GuideContent } from "@/lib/guides/types";
import { CF_REALTIME_CHAT_TUTORIAL } from "@/lib/marketing-links";

export const DISCORD_STYLE_CHAT_CF_GUIDE: GuideContent = {
  title: "Discord-style realtime chat on Cloudflare (no VPS)",
  subtitle:
    "Workers + Durable Objects + D1 (+ R2 for attachments) — the same “no container socket fleet” story as serverless Discord clones, packaged as a chat layer for your product.",
  sections: [
    {
      id: "story",
      title: "Why builders search for this",
      paragraphs: [
        "Show HN posts and CF tutorials keep winning with one message: realtime rooms without running your own WebSocket VM. Discord-style here means many clients in a room, ordered messages, presence — not cloning Discord’s entire product.",
        "FluxyChat targets teams who want that architecture for in-app SaaS chat, not a gaming social network.",
      ],
    },
    {
      id: "stack",
      title: "The Cloudflare stack (Accord-style)",
      bullets: [
        "Workers — HTTP API, JWT mint, WebSocket upgrade routing.",
        "One Durable Object per room — fan-out, typing, live connections.",
        "D1 — message history, search, tenant metadata.",
        "R2 (optional) — attachments; your Worker signs uploads.",
        "No Socket.io cluster on a VPS; no second realtime vendor if you self-host on CF.",
      ],
      link: CF_REALTIME_CHAT_TUTORIAL,
    },
    {
      id: "vs-socketio",
      title: "Replacing Socket.io or a VPS fleet",
      bullets: [
        "Socket.io on Node: you operate processes, regions, and sticky sessions.",
        "Room-per-DO: Cloudflare routes clients to the object that owns that room’s state.",
        "Client: @fluxy-chat/sdk (reconnect, loadMore) instead of hand-rolled socket.io client glue.",
        "Tradeoff: you learn CF billing and DO patterns — not a managed Pusher dashboard.",
      ],
    },
    {
      id: "fluxy",
      title: "Where FluxyChat fits",
      paragraphs: [
        "MIT monorepo with RoomDurableObject, operator console, agents on the same room WebSocket, hosted beta or deploy to your account. Use the demo to feel the UX, then self-host when you need control.",
      ],
    },
  ],
  seoTopics: [
    "discord clone cloudflare workers",
    "realtime chat without vps",
    "durable objects chat",
    "socket.io alternative cloudflare",
    "serverless websocket chat",
  ],
};
