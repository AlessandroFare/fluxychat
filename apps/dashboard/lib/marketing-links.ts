/** Public URLs reused across marketing pages (single source of truth). */

export const DEVTO_SOCKET_FLEET_ARTICLE = {
  href: "https://dev.to/fluxychat_sdk_330378fbf56/how-to-build-a-realtime-chat-app-on-cloudflare-workers-without-managing-a-socket-fleet-4hdh",
  title:
    "How to Build a Realtime Chat App on Cloudflare Workers (Without Managing a Socket Fleet)",
} as const;

/** Official Cloudflare Workers + DO chat example (tutorial search intent). */
export const CF_WORKERS_CHAT_DEMO = {
  href: "https://developers.cloudflare.com/durable-objects/examples/websocket-chat/",
  title: "Cloudflare Workers WebSocket chat demo",
} as const;

export const CF_DURABLE_OBJECTS_OVERVIEW = {
  href: "https://developers.cloudflare.com/durable-objects/",
  title: "Cloudflare Durable Objects overview",
} as const;

export const CF_DO_RULES = {
  href: "https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/",
  title: "Rules of Durable Objects",
} as const;

/** Official Workers tutorial — high-intent “real-time chat on Cloudflare”. */
export const CF_REALTIME_CHAT_TUTORIAL = {
  href: "https://developers.cloudflare.com/workers/tutorials/build-a-real-time-chat-application/",
  title: "Build a real-time chat application on Cloudflare Workers",
} as const;

export const MARKETING_GUIDE_PATHS = {
  cloudflareWorkersChat: "/guides/cloudflare-workers-chat",
  durableObjectsForChatRooms: "/guides/durable-objects-for-chat-rooms",
  vercelRealtimeWithoutPusher: "/guides/vercel-realtime-without-pusher",
  reconnectDurableObjectsHibernation:
    "/guides/reconnect-durable-objects-hibernation",
  afterCfChatTutorial: "/guides/after-cloudflare-chat-tutorial",
  nextjsVercelRealtimeChat: "/guides/nextjs-vercel-realtime-chat",
  agentEventsSameStream: "/guides/agent-events-same-websocket-stream",
  discordStyleChatCloudflare: "/guides/discord-style-chat-cloudflare",
  durableObjectsHibernationCost: "/guides/durable-objects-hibernation-cost",
  durableObjectsChatTradeoffs: "/guides/durable-objects-chat-tradeoffs",
  buildChatNextjsFluxychat: "/guides/build-chat-nextjs-fluxychat",
} as const;
