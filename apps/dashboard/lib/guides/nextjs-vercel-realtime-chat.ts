import type { GuideContent } from "@/lib/guides/types";

export const NEXTJS_VERCEL_REALTIME_CHAT_GUIDE: GuideContent = {
  title: "Realtime chat in Next.js on Vercel",
  subtitle:
    "Ship the App Router on Vercel; run WebSocket rooms on Cloudflare Workers + Durable Objects. Ably and Pusher are not the only path.",
  sections: [
    {
      title: "The buyer question Ably owns",
      paragraphs: [
        "Tutorials for “live app on Vercel” often assume Ably or Pusher because serverless functions are not a socket fleet. That is correct — the fix is not forcing WebSockets into Vercel alone, it is a dedicated realtime layer.",
      ],
    },
    {
      title: "FluxyChat integration shape",
      bullets: [
        "Route Handler or API route mints a member JWT with your fc_... key (server-only).",
        "Client component uses useChat({ roomId, client }) with baseUrl = your Worker.",
        "Map Ably channels or Pusher channels → FluxyChat roomIds.",
        "Use loadMore() after reconnect; connectionState drives UI copy.",
      ],
    },
    {
      title: "Why not a second vendor",
      bullets: [
        "Room-per-DO on your Cloudflare account — cost and data stay readable.",
        "MIT self-host when hosted beta is not enough.",
        "Same WebSocket stream for human messages and agent tool events.",
      ],
    },
    {
      title: "Code placement in Next.js",
      code: `// app/api/fluxy/token/route.ts — mint JWT server-side
// app/room/[id]/room-chat.tsx — "use client" + useChat

import { FluxyChatClient, useChat } from "@fluxy-chat/sdk";

const client = new FluxyChatClient({
  baseUrl: process.env.NEXT_PUBLIC_FLUXYCHAT_CLOUD_URL!,
  userId,
  token: memberJwtFromRouteHandler,
});`,
    },
  ],
  seoTopics: [
    "realtime chat next.js vercel",
    "websocket backend vercel",
    "ably alternative next.js",
    "reconnecting connections chat",
  ],
};
