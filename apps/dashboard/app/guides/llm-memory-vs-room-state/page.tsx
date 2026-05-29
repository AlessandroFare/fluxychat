import { MarketingGuidePage } from "@/components/marketing/marketing-guide-page";
import { LLM_MEMORY_VS_ROOM_STATE_GUIDE } from "@/lib/guides/llm-memory-vs-room-state";
import { relatedGuidesExcept } from "@/lib/guides/related-guides";
import { MARKETING_GUIDE_PATHS } from "@/lib/marketing-links";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata = buildPageMetadata({
  title: "LLM memory vs room state",
  description:
    "Separate model memory from app conversation state — Durable Objects, D1 history, and tool-call visibility for AI chat products.",
  path: MARKETING_GUIDE_PATHS.llmMemoryVsRoomState,
});

export default function LlmMemoryVsRoomStatePage() {
  return (
    <MarketingGuidePage
      content={LLM_MEMORY_VS_ROOM_STATE_GUIDE}
      path={MARKETING_GUIDE_PATHS.llmMemoryVsRoomState}
      relatedGuides={relatedGuidesExcept(MARKETING_GUIDE_PATHS.llmMemoryVsRoomState)}
    />
  );
}
