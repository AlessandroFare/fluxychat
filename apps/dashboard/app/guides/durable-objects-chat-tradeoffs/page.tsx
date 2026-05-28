import { MarketingGuidePage } from "@/components/marketing/marketing-guide-page";
import { DO_CHAT_TRADEOFFS_GUIDE } from "@/lib/guides/durable-objects-chat-tradeoffs";
import { relatedGuidesExcept } from "@/lib/guides/related-guides";
import { MARKETING_GUIDE_PATHS } from "@/lib/marketing-links";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata = buildPageMetadata({
  title: "Durable Objects tradeoffs for chat",
  description:
    "Single-threaded DOs per room, D1 for history, Workers vs DO — honest architecture FAQ for Cloudflare realtime chat.",
  path: MARKETING_GUIDE_PATHS.durableObjectsChatTradeoffs,
});

export default function DurableObjectsChatTradeoffsPage() {
  return (
    <MarketingGuidePage
      content={DO_CHAT_TRADEOFFS_GUIDE}
      path={MARKETING_GUIDE_PATHS.durableObjectsChatTradeoffs}
      relatedGuides={relatedGuidesExcept(
        MARKETING_GUIDE_PATHS.durableObjectsChatTradeoffs,
      )}
    />
  );
}
