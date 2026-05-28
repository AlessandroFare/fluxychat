import type { GuideContent } from "@/lib/guides/types";
import { DEVTO_SOCKET_FLEET_ARTICLE } from "@/lib/marketing-links";

export const BUILD_CHAT_NEXTJS_FLUXYCHAT_GUIDE: GuideContent = {
  title: "Build realtime chat with Next.js and FluxyChat",
  subtitle:
    "Nuxt/Vue-style CF tutorials, but for Next.js App Router: Route Handler JWT, client useChat, reconnect, and history pagination on Cloudflare Workers + Durable Objects.",
  sections: [
    {
      title: "Prerequisites",
      bullets: [
        "Next.js 14+ App Router on Vercel (or elsewhere).",
        "FluxyChat hosted beta or self-hosted Worker + D1.",
        "pnpm add @fluxy-chat/sdk",
      ],
    },
    {
      title: "1. Mint JWT server-side",
      code: `// app/api/chat/token/route.ts
export async function POST(req: Request) {
  const { userId } = await req.json();
  const res = await fetch(\`\${process.env.FLUXY_WORKER_URL}/auth/token\`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Fluxy-Api-Key": process.env.FLUXY_API_KEY!,
    },
    body: JSON.stringify({ userId, roles: ["member"], ttlSeconds: 3600 }),
  });
  return Response.json(await res.json());
}`,
    },
    {
      title: "2. Client room component",
      code: `"use client";
import { FluxyChatClient, useChat } from "@fluxy-chat/sdk";

const client = new FluxyChatClient({
  baseUrl: process.env.NEXT_PUBLIC_FLUXYCHAT_CLOUD_URL!,
  userId,
  token: memberJwt,
});

export function RoomChat({ roomId }: { roomId: string }) {
  const { messages, sendMessage, connectionState, loadMore, hasMore } =
    useChat({ roomId, client, replay: "connect" });

  return (/* render messages + connectionState + loadMore button */);
}`,
    },
    {
      title: "3. Reconnect and history",
      bullets: [
        "Show connectionState.status and nextRetryAt in the UI.",
        "Call loadMore() after refresh or reconnect.",
        "Use clientMessageId for idempotent retries on failed sends.",
      ],
    },
    {
      title: "4. Deploy split",
      paragraphs: [
        "Keep Next on Vercel; Worker on Cloudflare. Same pattern as Nuxt-on-Pages tutorials — only the framework import changes.",
      ],
      link: DEVTO_SOCKET_FLEET_ARTICLE,
    },
  ],
  seoTopics: [
    "next.js realtime chat cloudflare",
    "nuxt chat durable objects alternative",
    "useChat cloudflare workers",
    "build chat app nextjs vercel",
  ],
};
