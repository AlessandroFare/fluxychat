import type { GuideContent } from "@/lib/guides/types";

export const AGENT_EVENTS_SAME_STREAM_GUIDE: GuideContent = {
  title: "Agent events on the same WebSocket as chat",
  subtitle:
    "When humans and copilots share a room, debugging and handoffs are easier if tool_call, tool_result, and user messages share one ordered stream — not a side channel.",
  sections: [
    {
      title: "Pain from AI-at-work threads",
      bullets: [
        "Operators ask: what did the agent do, in which order, relative to the user?",
        "Split transports (chat in one pipe, tools in another) make replay and support harder.",
        "Observability improves when the room timeline is the source of truth.",
      ],
    },
    {
      title: "What FluxyChat streams on the room socket",
      bullets: [
        "User messages with deliveryStatus and clientMessageId.",
        "tool_call, tool_result, tool_error, and agentRun events on the same timeline.",
        "Optional webhooks for downstream automation — still keyed to room + project.",
        "Console + D1 for history export when you need audit, not only live fan-out.",
      ],
    },
    {
      title: "Demo narrative",
      paragraphs: [
        "In the operator console, open a room with an agent configured: mention the agent, watch tool events appear beside human messages, then inspect runs from the agents page. That is the workflow product teams describe when they want copilots inside SaaS, not a separate debug UI.",
      ],
    },
    {
      title: "React hook",
      code: `const { messages, invokeAgent, agentTyping } = useChat({
  roomId,
  client,
  agentId: "agt_…",
});

// messages includes user posts and agent/tool events for your UI to render`,
    },
  ],
  seoTopics: [
    "agent tool calls websocket",
    "copilot realtime chat",
    "ai agent observability",
    "shared workspace chat",
  ],
};
