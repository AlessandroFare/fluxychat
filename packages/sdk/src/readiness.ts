export type PlatformReadinessLabel = "production" | "beta" | "preview" | "prototype" | "labs";

export interface ReadinessEntry {
  label: string;
  readiness: PlatformReadinessLabel;
  href: string;
  description: string;
}

/**
 * Keep in sync with dashboard `DASHBOARD_LAB_HREFS` / preview flags.
 * Chat is GA. Verticals ship in the Worker but are Labs until they share the same ops bar.
 */
export const PLATFORM_READINESS: Readonly<Record<string, ReadinessEntry>> = {
  chat: { label: "Chat & rooms", readiness: "production", href: "/rooms", description: "Core messaging, presence, agents" },
  collab: { label: "Collab", readiness: "labs", href: "/collab", description: "Yjs CRDT + collab events on the room WebSocket" },
  stream: { label: "Stream", readiness: "labs", href: "/stream/demo", description: "Live events, HLS, WHIP + room fan-out" },
  voice: { label: "Voice AI", readiness: "labs", href: "/voice-ai", description: "Realtime voice pipeline (STT → LLM → TTS)" },
  game: { label: "FluxyGame", readiness: "labs", href: "/game", description: "Matchmaking + ticks on the room WebSocket" },
  iot: { label: "FluxyIoT", readiness: "labs", href: "/iot", description: "Device shadow, rules, live readings" },
  fleet: { label: "Fleet", readiness: "labs", href: "/fleet", description: "GPS ingest + dispatch room updates" },
  spatial: { label: "Spatial", readiness: "labs", href: "/spatial", description: "Digital twin scenes + spatial grants" },
  edu: { label: "FluxyEdu", readiness: "labs", href: "/edu", description: "Live classroom, polls, breakouts" },
  health: { label: "FluxyHealth", readiness: "labs", href: "/health", description: "Consent events + care workspace" },
  event: { label: "FluxyEvent", readiness: "labs", href: "/events", description: "Venue, stage, check-in, Q&A" },
  finance: { label: "FluxyFinance", readiness: "labs", href: "/finance", description: "Risk signals + compliance workspace" },
  continuity: { label: "Continuity", readiness: "labs", href: "/continuity", description: "Cross-device handoff / checkpoints" },
};

export function getReadinessEntry(id: keyof typeof PLATFORM_READINESS): ReadinessEntry {
  return PLATFORM_READINESS[id];
}
