import type { GuideContent } from "@/lib/guides/types";

export const PUSHER_ALTERNATIVE_SAAS_GUIDE: GuideContent = {
  title: "Pusher Channels alternative for SaaS chat",
  subtitle:
    "Not roll-your-own WebSockets on a VPS, not a full chat suite — a hosted or self-hostable room layer on Cloudflare with history and reconnect.",
  sections: [
    {
      title: "The three-way choice",
      bullets: [
        "Roll your own Socket.IO/WS on a VM — max control, max ops.",
        "Pusher/Ably/Stream — fast start, vendor bill, less schema ownership.",
        "FluxyChat — room-per-DO on Workers + D1, MIT self-host or hosted beta, SDK with loadMore.",
      ],
    },
    {
      title: "Where Pusher threads complain",
      bullets: [
        "History and replay need extra work on Channels.",
        "Pricing surprises at scale (connections, messages).",
        "Second vendor if the app already lives on Cloudflare.",
      ],
    },
    {
      title: "Migration sketch",
      bullets: [
        "Map channel names to roomIds.",
        "Mint JWTs server-side; client uses useChat.",
        "Keep Next on Vercel; Worker handles WS.",
      ],
    },
    {
      title: "When to stay on Pusher",
      paragraphs: [
        "Generic pub/sub, telco-scale fan-out, or you need their dashboard on day one. FluxyChat is for in-app tenant chat where you want D1 history and optional self-host.",
      ],
    },
  ],
  seoTopics: [
    "pusher alternative",
    "pusher channels alternative",
    "socket.io alternative saas",
    "managed websocket infrastructure",
    "build vs buy chat",
  ],
};
