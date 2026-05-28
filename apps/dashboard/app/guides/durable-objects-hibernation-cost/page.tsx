import { MarketingGuidePage } from "@/components/marketing/marketing-guide-page";
import { DO_HIBERNATION_COST_GUIDE } from "@/lib/guides/durable-objects-hibernation-cost";
import { relatedGuidesExcept } from "@/lib/guides/related-guides";
import { MARKETING_GUIDE_PATHS } from "@/lib/marketing-links";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata = buildPageMetadata({
  title: "Durable Objects hibernation and chat costs",
  description:
    "WebSocket hibernation, idle connections, and room-per-DO billing hygiene for Cloudflare chat — avoid runaway DO duration charges.",
  path: MARKETING_GUIDE_PATHS.durableObjectsHibernationCost,
});

export default function DurableObjectsHibernationCostPage() {
  return (
    <MarketingGuidePage
      content={DO_HIBERNATION_COST_GUIDE}
      path={MARKETING_GUIDE_PATHS.durableObjectsHibernationCost}
      relatedGuides={relatedGuidesExcept(
        MARKETING_GUIDE_PATHS.durableObjectsHibernationCost,
      )}
    />
  );
}
