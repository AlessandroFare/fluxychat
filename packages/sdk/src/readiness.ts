export type PlatformReadinessLabel = "production" | "beta" | "preview" | "prototype" | "labs";

export interface ReadinessEntry {
  label: string;
  readiness: PlatformReadinessLabel;
  href: string;
  description: string;
}

export const PLATFORM_READINESS: Readonly<Record<string, ReadinessEntry>> = {
  chat: { label: "Chat & rooms", readiness: "production", href: "/rooms", description: "Core messaging, presence, agents" },
  collab: { label: "Collab", readiness: "production", href: "/collab", description: "Yjs CRDT + client_event + collab.* server_event on room WS" },
  stream: { label: "Stream", readiness: "production", href: "/stream/demo", description: "Live events, HLS, WHIP auto-provision + room fan-out" },
  voice: { label: "Voice AI", readiness: "production", href: "/voice-ai", description: "Unified multimodal voice pipeline with legacy STT→LLM→TTS fallback" },
  game: { label: "FluxyGame", readiness: "production", href: "/game", description: "Edge matchmaking + authoritative ticks via room WS" },
  iot: { label: "FluxyIoT", readiness: "production", href: "/iot", description: "Device shadow, rules + live readings in room" },
  fleet: { label: "Fleet", readiness: "production", href: "/fleet", description: "GPS ingest + dispatch room live updates" },
  spatial: { label: "Spatial", readiness: "production", href: "/spatial", description: "Digital twin scenes, entity fan-out + MCP spatial grants" },
  edu: { label: "FluxyEdu", readiness: "production", href: "/edu", description: "Live classroom, polls, breakouts + capability events" },
  health: { label: "FluxyHealth", readiness: "production", href: "/health", description: "Consent capability events, compliance live workspace + audit trail" },
  event: { label: "FluxyEvent", readiness: "production", href: "/events", description: "Venue control, stage live, hybrid check-in + Q&A" },
  finance: { label: "FluxyFinance", readiness: "production", href: "/finance", description: "Risk signals, audit capability events + compliance live workspace" },
  continuity: { label: "Continuity", readiness: "production", href: "/continuity", description: "Checkpoint/handoff capability events + cross-device live workspace" },
};

export function getReadinessEntry(id: keyof typeof PLATFORM_READINESS): ReadinessEntry {
  return PLATFORM_READINESS[id];
}
