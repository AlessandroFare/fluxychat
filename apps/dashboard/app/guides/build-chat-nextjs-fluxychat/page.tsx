import { MarketingGuidePage } from "@/components/marketing/marketing-guide-page";
import { BUILD_CHAT_NEXTJS_FLUXYCHAT_GUIDE } from "@/lib/guides/build-chat-nextjs-fluxychat";
import { relatedGuidesExcept } from "@/lib/guides/related-guides";
import { MARKETING_GUIDE_PATHS } from "@/lib/marketing-links";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata = buildPageMetadata({
  title: "Build chat with Next.js and FluxyChat",
  description:
    "Step-by-step Next.js + Cloudflare Workers chat: JWT Route Handler, useChat, reconnect, loadMore — like Nuxt CF tutorials but for your stack.",
  path: MARKETING_GUIDE_PATHS.buildChatNextjsFluxychat,
});

export default function BuildChatNextjsFluxychatPage() {
  return (
    <MarketingGuidePage
      content={BUILD_CHAT_NEXTJS_FLUXYCHAT_GUIDE}
      path={MARKETING_GUIDE_PATHS.buildChatNextjsFluxychat}
      relatedGuides={relatedGuidesExcept(
        MARKETING_GUIDE_PATHS.buildChatNextjsFluxychat,
      )}
    />
  );
}
