import { MarketingGuidePage } from "@/components/marketing/marketing-guide-page";
import { API_KEY_MANAGEMENT_GUIDE } from "@/lib/guides/api-key-management";
import { relatedGuidesExcept } from "@/lib/guides/related-guides";
import { MARKETING_GUIDE_PATHS } from "@/lib/marketing-links";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata = buildPageMetadata({
  title: "API key management — rotate, scope, and revoke",
  description:
    "Best practices for managing FluxyChat API keys: project-scoped keys, rotation, and emergency revocation.",
  path: MARKETING_GUIDE_PATHS.apiKeyManagement,
});

export default function ApiKeyManagementGuidePage() {
  return (
    <MarketingGuidePage
      content={API_KEY_MANAGEMENT_GUIDE}
      path={MARKETING_GUIDE_PATHS.apiKeyManagement}
      relatedGuides={relatedGuidesExcept(MARKETING_GUIDE_PATHS.apiKeyManagement)}
    />
  );
}
