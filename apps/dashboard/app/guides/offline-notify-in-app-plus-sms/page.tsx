import { MarketingGuidePage } from "@/components/marketing/marketing-guide-page";
import { OFFLINE_NOTIFY_IN_APP_PLUS_SMS_GUIDE } from "@/lib/guides/offline-notify-in-app-plus-sms";
import { relatedGuidesExcept } from "@/lib/guides/related-guides";
import { MARKETING_GUIDE_PATHS } from "@/lib/marketing-links";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata = buildPageMetadata({
  title: "In-app chat + SMS when users are offline",
  description:
    "Pair FluxyChat webhooks with Sent.dm templates for mention and DM alerts — without confusing in-app transport with telco APIs.",
  path: MARKETING_GUIDE_PATHS.offlineNotifyInAppPlusSms,
});

export default function OfflineNotifyInAppPlusSmsPage() {
  return (
    <MarketingGuidePage
      content={OFFLINE_NOTIFY_IN_APP_PLUS_SMS_GUIDE}
      path={MARKETING_GUIDE_PATHS.offlineNotifyInAppPlusSms}
      relatedGuides={relatedGuidesExcept(MARKETING_GUIDE_PATHS.offlineNotifyInAppPlusSms)}
    />
  );
}

