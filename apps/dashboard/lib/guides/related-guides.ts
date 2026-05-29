import { MARKETING_GUIDE_PATHS } from "@/lib/marketing-links";
import type { RelatedGuide } from "@/lib/guides/types";

export const ALL_GUIDES: readonly RelatedGuide[] = [
  {
    href: MARKETING_GUIDE_PATHS.cloudflareWorkersChat,
    label: "Instant messaging on Cloudflare Workers",
  },
  {
    href: MARKETING_GUIDE_PATHS.durableObjectsForChatRooms,
    label: "Durable Objects for chat rooms",
  },
  {
    href: MARKETING_GUIDE_PATHS.vercelRealtimeWithoutPusher,
    label: "Realtime chat on Vercel without Pusher or Ably",
  },
  {
    href: MARKETING_GUIDE_PATHS.reconnectDurableObjectsHibernation,
    label: "Reconnect, replay, and DO hibernation",
  },
  {
    href: MARKETING_GUIDE_PATHS.afterCfChatTutorial,
    label: "After Cloudflare’s real-time chat tutorial",
  },
  {
    href: MARKETING_GUIDE_PATHS.nextjsVercelRealtimeChat,
    label: "Realtime chat in Next.js on Vercel",
  },
  {
    href: MARKETING_GUIDE_PATHS.agentEventsSameStream,
    label: "Agent events on the same WebSocket stream",
  },
  {
    href: MARKETING_GUIDE_PATHS.discordStyleChatCloudflare,
    label: "Discord-style chat on Cloudflare (no VPS)",
  },
  {
    href: MARKETING_GUIDE_PATHS.durableObjectsHibernationCost,
    label: "DO hibernation and chat costs",
  },
  {
    href: MARKETING_GUIDE_PATHS.durableObjectsChatTradeoffs,
    label: "DO tradeoffs for chat (single-threaded, D1)",
  },
  {
    href: MARKETING_GUIDE_PATHS.buildChatNextjsFluxychat,
    label: "Build chat with Next.js + FluxyChat",
  },
  {
    href: MARKETING_GUIDE_PATHS.pusherAlternativeSaas,
    label: "Pusher alternative for SaaS chat",
  },
  {
    href: MARKETING_GUIDE_PATHS.llmMemoryVsRoomState,
    label: "LLM memory vs room state",
  },
] as const;

export function relatedGuidesExcept(currentPath: string): readonly RelatedGuide[] {
  return ALL_GUIDES.filter((guide) => guide.href !== currentPath);
}
