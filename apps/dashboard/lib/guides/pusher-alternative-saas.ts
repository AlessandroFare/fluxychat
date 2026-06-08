import type { GuideContent } from "@/lib/guides/types";

export const PUSHER_ALTERNATIVE_SAAS_GUIDE: GuideContent = {
  title: "Pusher Channels alternative for SaaS chat",
  subtitle:
    "Pusher's free tier works until it doesn't. If connection pricing is climbing faster than your app, room chat on Cloudflare with optional self-host is worth a look.",
  sections: [
    {
      title: "Why people leave Pusher",
      bullets: [
        "Demo runs on the free tier; production traffic hits connection and message line items.",
        "Start on hosted beta; self-host on your Cloudflare account when you want cost control.",
        "You read Cloudflare DO/D1 pricing instead of guessing at a channels SKU.",
      ],
    },
    {
      title: "Three paths",
      bullets: [
        "Roll your own Socket.IO on a VM — full control, full ops.",
        "Pusher / Ably / Stream — fast start, vendor bill, less schema ownership.",
        "FluxyChat — room-per-DO on Workers + D1, MIT self-host or hosted beta, SDK with loadMore.",
      ],
    },
    {
      title: "What Pusher threads complain about",
      bullets: [
        "History and replay take extra work on Channels.",
        "Pricing at scale (connections, messages).",
        "Second vendor when the app already runs on Cloudflare.",
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
        "Generic pub/sub, telco-scale fan-out, or you need their dashboard tomorrow. FluxyChat is for tenant in-app chat where you want D1 history and the option to self-host.",
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
