import { MarketingGuidePage } from "@/components/marketing/marketing-guide-page";
import { AFTER_CF_CHAT_TUTORIAL_GUIDE } from "@/lib/guides/after-cloudflare-chat-tutorial";
import { relatedGuidesExcept } from "@/lib/guides/related-guides";
import { MARKETING_GUIDE_PATHS } from "@/lib/marketing-links";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata = buildPageMetadata({
  title: "After Cloudflare’s real-time chat tutorial",
  description:
    "Production-ready alternative to the official Cloudflare Workers chat tutorial: one DO per room, SDK, D1 history, operator console.",
  path: MARKETING_GUIDE_PATHS.afterCfChatTutorial,
});

export default function AfterCfChatTutorialPage() {
  return (
    <MarketingGuidePage
      content={AFTER_CF_CHAT_TUTORIAL_GUIDE}
      path={MARKETING_GUIDE_PATHS.afterCfChatTutorial}
      relatedGuides={relatedGuidesExcept(MARKETING_GUIDE_PATHS.afterCfChatTutorial)}
    />
  );
}
