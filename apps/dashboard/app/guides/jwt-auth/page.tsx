import { MarketingGuidePage } from "@/components/marketing/marketing-guide-page";
import { JWT_AUTH_GUIDE } from "@/lib/guides/jwt-auth";
import { relatedGuidesExcept } from "@/lib/guides/related-guides";
import { MARKETING_GUIDE_PATHS } from "@/lib/marketing-links";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata = buildPageMetadata({
  title: "JWT Authentication for self-hosted FluxyChat",
  description:
    "Configure JWT-based auth for your FluxyChat worker — issue, refresh, and verify tokens with HMAC signing.",
  path: MARKETING_GUIDE_PATHS.jwtAuth,
});

export default function JwtAuthGuidePage() {
  return (
    <MarketingGuidePage
      content={JWT_AUTH_GUIDE}
      path={MARKETING_GUIDE_PATHS.jwtAuth}
      relatedGuides={relatedGuidesExcept(MARKETING_GUIDE_PATHS.jwtAuth)}
    />
  );
}
