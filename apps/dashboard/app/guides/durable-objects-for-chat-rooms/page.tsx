import { MarketingGuidePage } from "@/components/marketing/marketing-guide-page";
import { DURABLE_OBJECTS_CHAT_ROOMS_GUIDE } from "@/lib/guides/durable-objects-for-chat-rooms";
import { relatedGuidesExcept } from "@/lib/guides/related-guides";
import { MARKETING_GUIDE_PATHS } from "@/lib/marketing-links";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata = buildPageMetadata({
  title: "Durable Objects for chat rooms",
  description:
    "Shared state coordination, WebSocket hibernation, and transactional consistency for chat on Cloudflare — how FluxyChat maps Room DOs and D1.",
  path: MARKETING_GUIDE_PATHS.durableObjectsForChatRooms,
});

export default function DurableObjectsForChatRoomsPage() {
  return (
    <MarketingGuidePage
      content={DURABLE_OBJECTS_CHAT_ROOMS_GUIDE}
      path={MARKETING_GUIDE_PATHS.durableObjectsForChatRooms}
      relatedGuides={relatedGuidesExcept(
        MARKETING_GUIDE_PATHS.durableObjectsForChatRooms,
      )}
    />
  );
}
