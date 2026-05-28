import { MarketingGuidePage } from "@/components/marketing/marketing-guide-page";
import { VERCEL_REALTIME_WITHOUT_PUSHER_GUIDE } from "@/lib/guides/vercel-realtime-without-pusher";
import { relatedGuidesExcept } from "@/lib/guides/related-guides";
import { MARKETING_GUIDE_PATHS } from "@/lib/marketing-links";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata = buildPageMetadata({
  title: "Realtime chat on Vercel without Pusher or Ably",
  description:
    "Keep Next.js on Vercel; run WebSocket chat on Cloudflare Workers + Durable Objects. Pusher alternative with room-per-DO and SDK reconnect.",
  path: MARKETING_GUIDE_PATHS.vercelRealtimeWithoutPusher,
});

export default function VercelRealtimeWithoutPusherPage() {
  return (
    <MarketingGuidePage
      content={VERCEL_REALTIME_WITHOUT_PUSHER_GUIDE}
      path={MARKETING_GUIDE_PATHS.vercelRealtimeWithoutPusher}
      relatedGuides={relatedGuidesExcept(
        MARKETING_GUIDE_PATHS.vercelRealtimeWithoutPusher,
      )}
    />
  );
}
