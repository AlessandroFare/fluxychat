import { MarketingGuidePage } from "@/components/marketing/marketing-guide-page";
import { AGENT_EVENTS_SAME_STREAM_GUIDE } from "@/lib/guides/agent-events-same-stream";
import { relatedGuidesExcept } from "@/lib/guides/related-guides";
import { MARKETING_GUIDE_PATHS } from "@/lib/marketing-links";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata = buildPageMetadata({
  title: "Agent events on the same WebSocket as chat",
  description:
    "Stream agent tool_call and tool_result on the room WebSocket with user messages — easier debugging, handoffs, and operator observability.",
  path: MARKETING_GUIDE_PATHS.agentEventsSameStream,
});

export default function AgentEventsSameStreamPage() {
  return (
    <MarketingGuidePage
      content={AGENT_EVENTS_SAME_STREAM_GUIDE}
      path={MARKETING_GUIDE_PATHS.agentEventsSameStream}
      relatedGuides={relatedGuidesExcept(MARKETING_GUIDE_PATHS.agentEventsSameStream)}
    />
  );
}
