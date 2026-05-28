import { MarketingGuidePage } from "@/components/marketing/marketing-guide-page";
import { CF_WORKERS_CHAT_GUIDE } from "@/lib/guides/cloudflare-workers-chat";
import { relatedGuidesExcept } from "@/lib/guides/related-guides";
import { MARKETING_GUIDE_PATHS } from "@/lib/marketing-links";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata = buildPageMetadata({
  title: "Cloudflare Workers chat with Durable Objects",
  description:
    "Build instant messaging on Cloudflare Workers: WebSockets, shared state coordination, one Durable Object per room, D1 history — realtime without a VPS.",
  path: MARKETING_GUIDE_PATHS.cloudflareWorkersChat,
});

export default function CloudflareWorkersChatGuidePage() {
  return (
    <MarketingGuidePage
      content={CF_WORKERS_CHAT_GUIDE}
      path={MARKETING_GUIDE_PATHS.cloudflareWorkersChat}
      relatedGuides={relatedGuidesExcept(MARKETING_GUIDE_PATHS.cloudflareWorkersChat)}
    />
  );
}
