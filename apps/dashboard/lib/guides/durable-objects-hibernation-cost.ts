import type { GuideContent } from "@/lib/guides/types";
import { CF_DURABLE_OBJECTS_OVERVIEW } from "@/lib/marketing-links";

export const DO_HIBERNATION_COST_GUIDE: GuideContent = {
  title: "Chat room costs: Durable Objects, hibernation, and idle WebSockets",
  subtitle:
    "Why idle WebSockets used to pin DOs in memory — and how room-per-DO chat plus D1 persistence keeps Cloudflare realtime costs understandable.",
  sections: [
    {
      id: "objection",
      title: "The cost fear (and what changed)",
      paragraphs: [
        "Teams evaluating CF realtime often hear: “WebSockets keep Durable Objects awake and you pay duration forever.” Hibernation APIs exist so idle connections can sleep; you still need a clear persistence and reconnect story.",
        "Cost surprises usually come from unbounded writes or one hot object, not from “using WebSockets” alone.",
      ],
      link: CF_DURABLE_OBJECTS_OVERVIEW,
    },
    {
      id: "model",
      title: "Mental model for chat billing",
      bullets: [
        "Room DO — live fan-out, presence, typing; wake on message or connection.",
        "D1 — durable messages; batch/async off the hot path.",
        "One DO per room — blast radius stays room-scoped (not one global coordinator).",
        "Avoid logging every keystroke into DO storage; rate-limit abusive clients.",
      ],
    },
    {
      id: "hibernation",
      title: "Hibernation + client replay",
      paragraphs: [
        "When a DO hibernates, clients disconnect. Production apps use REST history + SDK loadMore() and connectionState — see the reconnect guide.",
      ],
    },
    {
      id: "fluxy",
      title: "What FluxyChat does",
      bullets: [
        "RoomDurableObject per roomId — same pattern as CF demos, with quotas in the Worker.",
        "Console + budget alarms still on you — set CF notifications.",
        "Self-host: you see raw CF invoices; hosted beta: plan limits on messages/agents.",
      ],
    },
    {
      id: "checklist",
      title: "Cost hygiene checklist",
      bullets: [
        "Staging load test before prod traffic.",
        "Archive or delete dead rooms if you create thousands of idle DOs.",
        "Monitor DO requests/storage; don’t retry-loop on WebSocket close 1008.",
        "Read Cloudflare pricing pages for DO and D1 — FluxyChat does not flatten this into opaque “per connection” pricing.",
      ],
    },
  ],
  seoTopics: [
    "durable objects websocket hibernation cost",
    "cloudflare chat pricing",
    "idle websocket durable object",
    "room per durable object",
  ],
};
