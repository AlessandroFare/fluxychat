import type { GuideContent } from "@/lib/guides/types";

export const LLM_MEMORY_VS_ROOM_STATE_GUIDE: GuideContent = {
  title: "LLM memory vs room state in chat apps",
  subtitle:
    "The model forgetting context is a different problem from your app losing messages. Own replay, history, and tool visibility in your infrastructure.",
  sections: [
    {
      title: "Two different problems",
      bullets: [
        "LLM memory — what the model keeps in context or RAG; vendor-specific, prompt-sized.",
        "Room state — messages, tool_call, tool_result, who is connected; your product's job.",
      ],
    },
    {
      title: "What to store in your stack",
      bullets: [
        "D1 (or your DB) for durable timeline per room.",
        "Durable Object for live fan-out and presence.",
        "SDK reconnect + loadMore so refresh does not wipe the UI.",
      ],
    },
    {
      title: "Why operators still get burned",
      paragraphs: [
        "Teams bolt a copilot UI on one pipe and chat on another, then cannot answer what the agent did at 2pm. One WebSocket timeline for humans and tools fixes most support tickets.",
      ],
    },
    {
      title: "FluxyChat's slice",
      paragraphs: [
        "We do not fix model amnesia. We fix app state: room DO, D1 history, agent events on the same stream, console for runs.",
      ],
    },
  ],
  seoTopics: [
    "ai chat memory",
    "conversation state infrastructure",
    "agent tool call visibility",
    "durable objects chat",
  ],
};
