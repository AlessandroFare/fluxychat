import { MarketingGuidePage } from "@/components/marketing/marketing-guide-page";
import { PUSHER_ALTERNATIVE_SAAS_GUIDE } from "@/lib/guides/pusher-alternative-saas";
import { relatedGuidesExcept } from "@/lib/guides/related-guides";
import { MARKETING_GUIDE_PATHS } from "@/lib/marketing-links";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata = buildPageMetadata({
  title: "Pusher alternative for SaaS chat",
  description:
    "FluxyChat vs rolling your own WebSockets vs Pusher Channels — history, reconnect, Cloudflare room-per-DO, self-host option.",
  path: MARKETING_GUIDE_PATHS.pusherAlternativeSaas,
});

export default function PusherAlternativeSaasPage() {
  return (
    <MarketingGuidePage
      content={PUSHER_ALTERNATIVE_SAAS_GUIDE}
      path={MARKETING_GUIDE_PATHS.pusherAlternativeSaas}
      relatedGuides={relatedGuidesExcept(MARKETING_GUIDE_PATHS.pusherAlternativeSaas)}
    />
  );
}
