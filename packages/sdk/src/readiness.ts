export type PlatformReadinessLabel = "production" | "beta" | "preview" | "prototype" | "labs";

export interface ReadinessEntry {
  label: string;
  readiness: PlatformReadinessLabel;
  href: string;
  description: string;
}

/**
 * Product modules on the free path. Hosted is still open beta (no SLA).
 * Production = Worker persist + auth + tenancy + tests. Not a hosted GA / HIPAA / SFU SKU claim.
 * Out of scope: SOC 2 attestation, HIPAA BAA, 99.999% uptime, MQTT broker, dedicated game servers.
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
    readiness: "production",
    href: "/stream",
    description: "Live event rooms, overlays, and chat. WHIP/HLS needs Cloudflare Stream secrets",
  },
  voice: {
    label: "Voice AI",
    readiness: "production",
    href: "/voice-ai",
    description: "Workers AI STT/TTS and joinVoiceStage signaling. No unpublished latency SLA",
  },
  huddles: {
    label: "Huddles",
    readiness: "labs",
    href: "/huddles",
    description: "Audio and video huddles. Media is Cloudflare Realtime SFU when secrets exist; not an SFU product",
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
    description: "Stake and dispute claims in-room. Internal credits, not money",
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
    readiness: "production",
    href: "/driver",
    description: "PWA driver client for fleet GPS rooms",
  },
  game: {
    label: "FluxyGame",
    readiness: "production",
    href: "/game",
    description: "Match ticks, leaderboard, and checkpoints on D1. Not rollback netcode",
  },
  iot: {
    label: "FluxyIoT",
    readiness: "production",
    href: "/iot",
    description: "HTTP ingest, device shadow, and room fan-out. Not MQTT",
  },
  fleet: {
    label: "Fleet",
    readiness: "production",
    href: "/fleet",
    description: "Vehicles, trips, geofences, and OwnTracks-shaped GPS ingest",
  },
  spatial: {
    label: "Spatial",
    readiness: "labs",
    href: "/spatial",
    description: "Scenes, entities, and agent grants on /spatial. Not a game engine",
  },
  edu: {
    label: "FluxyEdu",
    readiness: "production",
    href: "/edu",
    description: "Polls, breakouts, attendance, and room timer on the classroom room",
  },
  health: {
    label: "FluxyHealth",
    readiness: "production",
    href: "/health",
    description: "Consent and care-room capability events. No HIPAA BAA",
  },
  event: {
    label: "FluxyEvent",
    readiness: "production",
    href: "/events",
    description: "Stage live, hybrid check-in, and moderated Q&A on the room",
  },
  finance: {
    label: "FluxyFinance",
    readiness: "production",
    href: "/finance",
    description: "Risk flags and approval events. No PAN, no trade execution",
  },
  continuity: {
    label: "Continuity",
    readiness: "production",
    href: "/continuity",
    description: "Device checkpoints and handoff events on the room",
  },
  marketplace: {
    label: "Marketplace",
    readiness: "production",
    href: "/marketplace",
    description: "Agent templates, KV apps, MCP catalog. Not a public app store",
  },
  "chatbot-builder": {
    label: "Chatbot builder",
    readiness: "production",
    href: "/chatbot-builder",
    description: "Trigger-action rules and production webhooks on the Worker",
  },
  web3: {
    label: "Web3 rooms",
    readiness: "production",
    href: "/web3",
    description: "Worker SIWE mint plus optional address allowlist. NFT gates stay optional RPC on your side",
  },
};

export function getReadinessEntry(id: keyof typeof PLATFORM_READINESS): ReadinessEntry {
  return PLATFORM_READINESS[id];
}
