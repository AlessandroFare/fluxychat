import { MarketingGuidePage } from "@/components/marketing/marketing-guide-page";
import { DISCORD_STYLE_CHAT_CF_GUIDE } from "@/lib/guides/discord-style-chat-cloudflare";
import { relatedGuidesExcept } from "@/lib/guides/related-guides";
import { MARKETING_GUIDE_PATHS } from "@/lib/marketing-links";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata = buildPageMetadata({
  title: "Discord-style chat on Cloudflare without a VPS",
  description:
    "Serverless Discord-style realtime on Workers + Durable Objects + D1. Replace Socket.io or a VPS socket fleet with room-per-DO chat.",
  path: MARKETING_GUIDE_PATHS.discordStyleChatCloudflare,
});

export default function DiscordStyleChatCloudflarePage() {
  return (
    <MarketingGuidePage
      content={DISCORD_STYLE_CHAT_CF_GUIDE}
      path={MARKETING_GUIDE_PATHS.discordStyleChatCloudflare}
      relatedGuides={relatedGuidesExcept(
        MARKETING_GUIDE_PATHS.discordStyleChatCloudflare,
      )}
    />
  );
}
