import type { GuideContent } from "@/lib/guides/types";
import { CF_DO_RULES } from "@/lib/marketing-links";

export const DO_CHAT_TRADEOFFS_GUIDE: GuideContent = {
  title: "Single-threaded Durable Objects and chat — honest tradeoffs",
  subtitle:
    "When the Room DO is the source of truth, when D1 is, and what throughput to expect per room (without pretending one object scales infinite hot rooms).",
  sections: [
    {
      id: "single-thread",
      title: "“DOs are single-threaded” — what it means for chat",
      paragraphs: [
        "Each Durable Object processes requests sequentially. For one chat room, that is often a feature: ordering is straightforward and you avoid distributed locks inside the room.",
        "A single ultra-hot room (thousands of messages per second in one channel) may need sharding or fan-out patterns beyond one object — most SaaS tenant rooms are far below that.",
      ],
      link: CF_DO_RULES,
    },
    {
      id: "do-vs-d1",
      title: "DO vs D1 — division of labor",
      bullets: [
        "DO — who is connected now, fan-out, ephemeral signals (typing).",
        "D1 — durable messages, membership, audit-friendly history.",
        "Worker — auth, REST pagination, webhooks, GDPR export.",
        "Do not treat DO storage as your message database for unbounded history.",
      ],
    },
    {
      id: "workers-only",
      title: "Workers only (no DO)?",
      paragraphs: [
        "Stateless Workers cannot hold open WebSocket fan-out for a room across clients. You need sticky coordination — that is the DO (or an external broker). “Just Workers” fits HTTP, not multi-client room state.",
      ],
    },
    {
      id: "fluxy",
      title: "FluxyChat’s scope",
      paragraphs: [
        "We optimize for many rooms with moderate throughput each, not one global firehose. If you outgrow one room object, you shard by roomId (multiple products) or redesign that hot channel — we do not hide that limit.",
      ],
    },
  ],
  seoTopics: [
    "durable objects single threaded",
    "durable objects vs d1 chat",
    "cloudflare workers vs durable objects",
    "room state source of truth",
  ],
};
