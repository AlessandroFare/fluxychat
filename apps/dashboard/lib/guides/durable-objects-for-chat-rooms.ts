import {
  CF_DO_RULES,
  CF_DURABLE_OBJECTS_OVERVIEW,
  CF_WORKERS_CHAT_DEMO,
} from "@/lib/marketing-links";
import type { GuideContent } from "@/lib/guides/types";

export const DURABLE_OBJECTS_CHAT_ROOMS_GUIDE: GuideContent = {
  title: "Durable Objects for chat rooms",
  subtitle:
    "Shared state coordination, transactional consistency, and WebSocket hibernation — the Cloudflare primitives behind edge-native chat without a socket fleet.",
  sections: [
    {
      id: "why-do",
      title: "Why Durable Objects fit chat",
      paragraphs: [
        "Cloudflare documents Durable Objects for coordination problems: chat rooms, multiplayer games, collaborative documents, and any workload that needs strongly consistent shared state on the edge.",
        "A chat room is exactly that pattern: one coordination point per room, many WebSocket clients, ordered fan-out, and optional persistence to D1.",
      ],
      link: CF_DO_RULES,
    },
    {
      id: "vocabulary",
      title: "Vocabulary buyers search for",
      bullets: [
        "Shared state coordination — one Room DO holds live connections and ephemeral signals (typing, presence).",
        "Transactional consistency — membership and message writes go through D1 with clear project scoping.",
        "WebSocket hibernation — the DO can sleep while clients reconnect; your app still needs client-side replay semantics.",
        "cloudflare workers websocket — HTTP + upgrade on the Worker, sticky room state on the DO.",
        "durable objects chat — one object name per roomId, not one global socket server.",
      ],
      link: CF_DURABLE_OBJECTS_OVERVIEW,
    },
    {
      id: "fluxy-mapping",
      title: "How FluxyChat maps the primitives",
      bullets: [
        "RoomDurableObject — one DO per room for fan-out, ordering, and connection lifecycle.",
        "D1 — queryable history, templates, webhooks metadata; not every keystroke as a hot write.",
        "Worker — JWT mint, REST writes, GDPR export, and `/ws/room/:roomId` upgrade routing.",
        "SDK — connectionState, loadMore (history replay), clientMessageId idempotency on reconnect.",
      ],
    },
    {
      id: "partykit",
      title: "PartyKit vs chat-layer DOs",
      paragraphs: [
        "PartyKit and DO demos excel at collab “party” state and tutorials. FluxyChat targets SaaS in-app messaging: multi-tenant JWT, operator console, billing hooks, and production reconnect — not a generic party runtime.",
      ],
    },
    {
      id: "human-agent",
      title: "Shared human + agent workspace",
      paragraphs: [
        "Agentic products need the same durable room state for people and bots: tool_call, tool_result, and agentRun events on the same WebSocket timeline as user messages. FluxyChat ships that on the room stream so you do not fork transport for AI features.",
      ],
    },
    {
      title: "From official demo to production",
      paragraphs: [
        "Start with Cloudflare’s Workers chat example, then add auth, history pagination, quotas, and operator tooling — or adopt FluxyChat as the maintained layer.",
      ],
      link: CF_WORKERS_CHAT_DEMO,
    },
  ],
  seoTopics: [
    "durable objects chat",
    "shared state coordination",
    "cloudflare workers websocket",
    "websocket hibernation",
    "chat rooms durable objects",
  ],
};
