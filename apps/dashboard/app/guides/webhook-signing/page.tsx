import { MarketingGuidePage } from "@/components/marketing/marketing-guide-page";
import { WEBHOOK_SIGNING_GUIDE } from "@/lib/guides/webhook-signing";
import { relatedGuidesExcept } from "@/lib/guides/related-guides";
import { MARKETING_GUIDE_PATHS } from "@/lib/marketing-links";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata = buildPageMetadata({
  title: "Webhook signing and verification",
  description:
    "Verify webhook payloads with HMAC-SHA256 signatures and prevent replay attacks.",
  path: MARKETING_GUIDE_PATHS.webhookSigning,
});

export default function WebhookSigningGuidePage() {
  return (
    <MarketingGuidePage
      content={WEBHOOK_SIGNING_GUIDE}
      path={MARKETING_GUIDE_PATHS.webhookSigning}
      relatedGuides={relatedGuidesExcept(MARKETING_GUIDE_PATHS.webhookSigning)}
    />
  );
}
