import { MarketingGuidePage } from "@/components/marketing/marketing-guide-page";
import { GDPR_COMPLIANCE_GUIDE } from "@/lib/guides/gdpr-compliance";
import { relatedGuidesExcept } from "@/lib/guides/related-guides";
import { MARKETING_GUIDE_PATHS } from "@/lib/marketing-links";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata = buildPageMetadata({
  title: "GDPR compliance and data retention",
  description:
    "Export, anonymize, and delete user data to comply with GDPR and privacy regulations.",
  path: MARKETING_GUIDE_PATHS.gdprCompliance,
});

export default function GdprComplianceGuidePage() {
  return (
    <MarketingGuidePage
      content={GDPR_COMPLIANCE_GUIDE}
      path={MARKETING_GUIDE_PATHS.gdprCompliance}
      relatedGuides={relatedGuidesExcept(MARKETING_GUIDE_PATHS.gdprCompliance)}
    />
  );
}
