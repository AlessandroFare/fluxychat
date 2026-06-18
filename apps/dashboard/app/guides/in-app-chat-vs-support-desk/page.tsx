import { MarketingGuidePage } from "@/components/marketing/marketing-guide-page";
import { IN_APP_CHAT_VS_SUPPORT_DESK_GUIDE } from "@/lib/guides/in-app-chat-vs-support-desk";
import { relatedGuidesExcept } from "@/lib/guides/related-guides";
import { MARKETING_GUIDE_PATHS } from "@/lib/marketing-links";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata = buildPageMetadata({
  title: "In-app chat vs support desk",
  description:
    "FluxyChat is room infrastructure for chat inside your SaaS — not Intercom or Zendesk. SDK, agent timeline, optional self-host on Cloudflare.",
  path: MARKETING_GUIDE_PATHS.inAppChatVsSupportDesk,
});

export default function InAppChatVsSupportDeskPage() {
  return (
    <MarketingGuidePage
      content={IN_APP_CHAT_VS_SUPPORT_DESK_GUIDE}
      path={MARKETING_GUIDE_PATHS.inAppChatVsSupportDesk}
      relatedGuides={relatedGuidesExcept(MARKETING_GUIDE_PATHS.inAppChatVsSupportDesk)}
    />
  );
}

