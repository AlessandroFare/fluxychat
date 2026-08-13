import { MarketingGuidePage } from "@/components/marketing/marketing-guide-page";
import { SESSION_SECURITY_GUIDE } from "@/lib/guides/session-security";
import { relatedGuidesExcept } from "@/lib/guides/related-guides";
import { MARKETING_GUIDE_PATHS } from "@/lib/marketing-links";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata = buildPageMetadata({
  title: "Session security: storage, refresh, and token lifecycle",
  description:
    "Best practices for managing FluxyChat sessions: secure token storage, refresh strategies, and preventing session fixation.",
  path: MARKETING_GUIDE_PATHS.sessionSecurity,
});

export default function SessionSecurityGuidePage() {
  return (
    <MarketingGuidePage
      content={SESSION_SECURITY_GUIDE}
      path={MARKETING_GUIDE_PATHS.sessionSecurity}
      relatedGuides={relatedGuidesExcept(MARKETING_GUIDE_PATHS.sessionSecurity)}
    />
  );
}
