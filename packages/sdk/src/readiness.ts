export type PlatformReadinessLabel = "production" | "beta" | "preview" | "prototype" | "labs";

export interface ReadinessEntry {
  label: string;
  readiness: PlatformReadinessLabel;
  href: string;
  description: string;
}

/**
 * Keep in sync with dashboard `DASHBOARD_LAB_HREFS` / preview flags.
 * Chat is GA. Collab / IoT / fleet / game are beta once a gallery example exists.
 * Stream, voice-ai, and health stay labs.
 */
export const PLATFORM_READINESS: Readonly<Record<string, ReadinessEntry>> = {
  chat: { label: "Chat & rooms", readiness: "production", href: "/rooms", description: "Core messaging, presence, agents" },
  collab: { label: "Collab", readiness: "beta", href: "/collab", description: "Yjs + Tiptap on the room WebSocket (--example tiptap-room)" },
  stream: { label: "Stream", readiness: "labs", href: "/stream/demo", description: "Live events, HLS, WHIP + room fan-out" },
  voice: { label: "Voice AI", readiness: "labs", href: "/voice-ai", description: "Workers AI STT/TTS — no unpublished latency claims" },
  game: { label: "FluxyGame", readiness: "beta", href: "/game", description: "Match ticks as server_event (--example game-tick). Not a netcode engine." },
  iot: { label: "FluxyIoT", readiness: "beta", href: "/iot", description: "HTTP ingest + device shadow (--example iot-panel). Not MQTT." },
  fleet: { label: "Fleet", readiness: "beta", href: "/fleet", description: "GPS ingest + fleet.gps_update (--example fleet-panel)" },
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
