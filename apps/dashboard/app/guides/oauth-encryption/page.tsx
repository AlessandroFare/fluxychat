import { MarketingGuidePage } from "@/components/marketing/marketing-guide-page";
import { OAUTH_ENCRYPTION_GUIDE } from "@/lib/guides/oauth-encryption";
import { relatedGuidesExcept } from "@/lib/guides/related-guides";
import { MARKETING_GUIDE_PATHS } from "@/lib/marketing-links";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata = buildPageMetadata({
  title: "OAuth token encryption at rest",
  description:
    "Encrypt stored OAuth tokens with AES-256-GCM using the FluxyChat TokenCrypto utility.",
  path: MARKETING_GUIDE_PATHS.oauthEncryption,
});

export default function OauthEncryptionGuidePage() {
  return (
    <MarketingGuidePage
      content={OAUTH_ENCRYPTION_GUIDE}
      path={MARKETING_GUIDE_PATHS.oauthEncryption}
      relatedGuides={relatedGuidesExcept(MARKETING_GUIDE_PATHS.oauthEncryption)}
    />
  );
}
