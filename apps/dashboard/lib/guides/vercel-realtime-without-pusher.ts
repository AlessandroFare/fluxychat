import type { GuideContent } from "@/lib/guides/types";

export const VERCEL_REALTIME_WITHOUT_PUSHER_GUIDE: GuideContent = {
  title: "Realtime chat on Vercel without Pusher or Ably",
  subtitle:
    "Vercel excels at HTTP and SSR. Long-lived WebSocket rooms belong on Cloudflare Workers + Durable Objects — keep your Next.js app on Vercel, run chat edge-native.",
  sections: [
    {
      id: "problem",
      title: "Why “just add Pusher on Vercel” is the default",
      paragraphs: [
        "Vercel’s own guides and third-party tutorials often route teams to Pusher Channels or Ably when they need live features. That works, but you add a second realtime vendor, another bill, and another region to reason about.",
        "Builders also hit WebSocket limits and pricing friction when they try to keep everything on serverless functions alone.",
      ],
    },
    {
      id: "split",
      title: "Recommended architecture split",
      bullets: [
        "Vercel — Next.js App Router, auth UI, billing pages, marketing.",
        "Cloudflare Worker + Room DO — WebSocket upgrade, room fan-out, presence.",
        "D1 — message history and tenant metadata on your CF account.",
        "Browser — @fluxy-chat/sdk pointed at your Worker URL; mint JWTs from a Vercel Route Handler or API route.",
      ],
    },
    {
      id: "vs-pusher",
      title: "FluxyChat vs Pusher on Vercel",
      bullets: [
        "No Channels app or Pusher keys in the frontend — member JWT from your backend only.",
        "Room-per-DO isolation instead of a global channel namespace you wire yourself.",
        "Reconnect, loadMore history, and delivery status in the SDK — not only pub/sub events.",
        "Optional MIT self-host on your Cloudflare account when hosted beta is not enough.",
      ],
    },
    {
      id: "migration",
      title: "Migration sketch (Pusher → FluxyChat)",
      bullets: [
        "Deploy FluxyChat Worker (hosted beta or self-host) and create a project + API key.",
        "Replace Pusher client subscribe with FluxyChatClient + useChat({ roomId, client }).",
        "Map channel names to roomIds; persist history via REST/D1 instead of Pusher-only caches.",
        "Mint per-user JWTs server-side on Vercel; never expose fc_... keys to the browser.",
      ],
    },
    {
      id: "diy",
      title: "Build vs buy on the same stack",
      paragraphs: [
        "You can still DIY a Durable Objects chat repo on GitHub — FluxyChat is for teams that want multi-tenant JWT, RoomDurableObject, D1 history, and operator console without stitching a second vendor. See the DIY comparison on /compare.",
      ],
    },
  ],
  seoTopics: [
    "realtime chat on vercel",
    "pusher alternative vercel",
    "ably alternative next.js",
    "vercel websocket limits",
    "cloudflare workers websocket",
  ],
};
