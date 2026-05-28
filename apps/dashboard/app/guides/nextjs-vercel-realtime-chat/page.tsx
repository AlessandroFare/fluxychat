import { MarketingGuidePage } from "@/components/marketing/marketing-guide-page";
import { NEXTJS_VERCEL_REALTIME_CHAT_GUIDE } from "@/lib/guides/nextjs-vercel-realtime-chat";
import { relatedGuidesExcept } from "@/lib/guides/related-guides";
import { MARKETING_GUIDE_PATHS } from "@/lib/marketing-links";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata = buildPageMetadata({
  title: "Realtime chat in Next.js on Vercel",
  description:
    "Build realtime chat in Next.js on Vercel without Ably or Pusher: Cloudflare Workers, Durable Objects, useChat, reconnecting connections.",
  path: MARKETING_GUIDE_PATHS.nextjsVercelRealtimeChat,
});

export default function NextjsVercelRealtimeChatPage() {
  return (
    <MarketingGuidePage
      content={NEXTJS_VERCEL_REALTIME_CHAT_GUIDE}
      path={MARKETING_GUIDE_PATHS.nextjsVercelRealtimeChat}
      relatedGuides={relatedGuidesExcept(MARKETING_GUIDE_PATHS.nextjsVercelRealtimeChat)}
    />
  );
}
