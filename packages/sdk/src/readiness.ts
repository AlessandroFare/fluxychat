export type PlatformReadinessLabel = "production" | "beta" | "preview" | "prototype" | "labs";

export interface ReadinessEntry {
  label: string;
  readiness: PlatformReadinessLabel;
  href: string;
  description: string;
}

/**
 * Product modules on the free path. Hosted is still open beta (no SLA).
 * Kernel chat + Yjs are production. Verticals ship; they are not a hosted GA claim.
 * Out of scope: SOC 2 attestation, HIPAA BAA, 99.999% uptime.
 */
export const PLATFORM_READINESS: Readonly<Record<string, ReadinessEntry>> = {
  chat: {
    label: "Chat & rooms",
    readiness: "production",
    href: "/rooms",
    description: "Messaging, presence, and invokeAgent on one Durable Object",
  },
  collab: {
    label: "FluxyCollab",
    readiness: "production",
    href: "/collab",
    description: "Yjs on the room WebSocket. Tiptap/Excalidraw renderers stay in your app",
  },
  stream: {
    label: "FluxyStream",
    readiness: "beta",
    href: "/stream",
    description: "Live event rooms + chat overlay. WHIP/HLS via Cloudflare Stream secrets",
  },
  voice: {
    label: "Voice AI",
    readiness: "labs",
    href: "/voice-ai",
    description: "Workers AI STT/TTS and joinVoiceStage signaling. No unpublished latency SLA",
  },
  huddles: {
    label: "Huddles",
    readiness: "labs",
    href: "/huddles",
    description: "Audio and video huddles. Default media path is Cloudflare Realtime SFU; LiveKit JWT is a fallback",
  },
  cartography: {
    label: "Cartography",
    readiness: "labs",
    href: "/cartography",
    description: "Thematic room maps from message embeddings",
  },
  "truth-market": {
    label: "Truth Market",
    readiness: "labs",
    href: "/truth-market",
    description: "Stake and dispute claims in-room",
  },
  transport: {
    label: "Fallback transports",
    readiness: "labs",
    href: "/transport",
    description: "WebSocket plus SSE and long-poll fallback. WebTransport is not a live Worker listener",
  },
  "cross-channel": {
    label: "Cross-channel",
    readiness: "labs",
    href: "/cross-channel",
    description: "Unified identity and journeys across channels",
  },
  driver: {
    label: "Driver app",
    readiness: "labs",
    href: "/driver",
    description: "PWA driver client for fleet rooms",
  },
  game: {
    label: "FluxyGame",
    readiness: "beta",
    href: "/game",
    description: "Match ticks, leaderboard, and checkpoints on D1. Not rollback netcode",
  },
  iot: {
    label: "FluxyIoT",
    readiness: "beta",
    href: "/iot",
    description: "HTTP ingest, device shadow, and room fan-out. Not MQTT",
  },
  fleet: {
    label: "Fleet",
    readiness: "beta",
    href: "/fleet",
    description: "Vehicles, trips, geofences, and GPS fan-out",
  },
  spatial: {
    label: "Spatial",
    readiness: "labs",
    href: "/spatial",
    description: "Scenes, entities, and agent grants on /spatial. Not a game engine",
  },
  edu: {
    label: "FluxyEdu",
    readiness: "beta",
    href: "/edu",
    description: "Polls, breakouts, and attendance heartbeats on the room",
  },
  health: {
    label: "FluxyHealth",
    readiness: "labs",
    href: "/health",
    description: "Consent and care-room capability events. No HIPAA BAA",
  },
  event: {
    label: "FluxyEvent",
    readiness: "labs",
    href: "/events",
    description: "Stage live, hybrid check-in, and moderated Q&A",
  },
  finance: {
    label: "FluxyFinance",
    readiness: "labs",
    href: "/finance",
    description: "Risk flags and approval events. No PAN, no trade execution",
  },
  continuity: {
    label: "Continuity",
    readiness: "labs",
    href: "/continuity",
    description: "Device checkpoints and handoff events on the room",
  },
  marketplace: {
    label: "Marketplace",
    readiness: "beta",
    href: "/marketplace",
    description: "Agent templates, KV apps, MCP catalog. ApyHub is remote MCP",
  },
  "chatbot-builder": {
    label: "Chatbot builder",
    readiness: "beta",
    href: "/chatbot-builder",
    description: "Trigger-action rules stored on the Worker",
  },
  web3: {
    label: "Web3 rooms",
    readiness: "beta",
    href: "/web3",
    description: "Worker SIWE mint plus optional address allowlist. NFT gates stay optional RPC on your side",
  },
};

export function getReadinessEntry(id: keyof typeof PLATFORM_READINESS): ReadinessEntry {
  return PLATFORM_READINESS[id];
}
