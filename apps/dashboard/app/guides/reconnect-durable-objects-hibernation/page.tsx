import { MarketingGuidePage } from "@/components/marketing/marketing-guide-page";
import { RECONNECT_HIBERNATION_GUIDE } from "@/lib/guides/reconnect-durable-objects-hibernation";
import { relatedGuidesExcept } from "@/lib/guides/related-guides";
import { MARKETING_GUIDE_PATHS } from "@/lib/marketing-links";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata = buildPageMetadata({
  title: "Reconnect, replay, and Durable Object hibernation",
  description:
    "How FluxyChat handles WebSocket reconnect, loadMore history replay, and connectionState when Room Durable Objects hibernate on Cloudflare.",
  path: MARKETING_GUIDE_PATHS.reconnectDurableObjectsHibernation,
});

export default function ReconnectDurableObjectsHibernationPage() {
  return (
    <MarketingGuidePage
      content={RECONNECT_HIBERNATION_GUIDE}
      path={MARKETING_GUIDE_PATHS.reconnectDurableObjectsHibernation}
      relatedGuides={relatedGuidesExcept(
        MARKETING_GUIDE_PATHS.reconnectDurableObjectsHibernation,
      )}
    />
  );
}
