export type PlatformReadinessLabel = "production" | "beta" | "preview" | "prototype" | "labs";

export interface ReadinessEntry {
  label: string;
  readiness: PlatformReadinessLabel;
  href: string;
  description: string;
}

/**
 * Product modules on the free path. Hosted is still open beta (no SLA).
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
    readiness: "production",
    href: "/stream",
    description: "Live event rooms + chat overlay. WHIP/HLS via Cloudflare Stream secrets",
  },
  voice: {
    label: "Voice AI",
    readiness: "production",
    href: "/voice-ai",
    description: "Workers AI STT/TTS and joinVoiceStage signaling. No unpublished latency SLA",
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
    description: "Vehicles, trips, geofences, and GPS fan-out",
  },
  spatial: {
    label: "Spatial",
    readiness: "production",
    href: "/spatial",
    description: "Scenes, entities, and agent grants on /spatial. Not a game engine",
  },
  edu: {
    label: "FluxyEdu",
    readiness: "production",
    href: "/edu",
    description: "Polls, breakouts, and attendance heartbeats on the room",
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
    description: "Stage live, hybrid check-in, and moderated Q&A",
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
    description: "Agent templates, KV apps, MCP catalog. ApyHub is remote MCP",
  },
  "chatbot-builder": {
    label: "Chatbot builder",
    readiness: "production",
    href: "/chatbot-builder",
    description: "Trigger-action rules stored on the Worker",
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
