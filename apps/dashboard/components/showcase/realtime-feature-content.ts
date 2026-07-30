import type { LucideIcon } from "lucide-react";
import {
  ArrowRightLeft,
  Bell,
  Boxes,
  Cpu,
  Gamepad2,
  GraduationCap,
  MapPin,
  MessageSquare,
  Pen,
  Radio,
  Mic,
  Truck,
  Video,
} from "lucide-react";

export type RealtimeFeatureId =
  | "chat"
  | "streaming"
  | "location"
  | "push"
  | "ai-transport"
  | "voice"
  | "collab"
  | "fluxy-stream"
  | "game"
  | "iot"
  | "fleet"
  | "spatial"
  | "edu-live"
  | "omnichannel";
export type CodeTokenKind = "plain" | "keyword" | "identifier" | "string";

export interface CodeToken {
  text: string;
  kind?: CodeTokenKind;
}

export interface RealtimeFeature {
  id: RealtimeFeatureId;
  label: string;
  title: string;
  description: string;
  icon: LucideIcon;
  code: readonly CodeToken[];
}

export const REALTIME_FEATURES: readonly RealtimeFeature[] = [
  {
    id: "chat",
    label: "In-App Chat",
    title: "Ship a chat feature in an afternoon.",
    description:
      "Rooms, presence, threads, and reactions over one WebSocket. Vertical events (polls, breakouts, stage live) arrive on the same connection via onServerEvent — no second subscription layer.",
    icon: MessageSquare,
    code: [
      { text: "const", kind: "keyword" },
      { text: " { messages, sendMessage } = " },
      { text: "useChat", kind: "identifier" },
      { text: "({\n  roomId: " },
      { text: '"chat:room-42"', kind: "string" },
      { text: ",\n  client,\n  onServerEvent: (ev) => {\n    if (ev.name === " },
      { text: '"edu.poll.created"', kind: "string" },
      { text: ") showPoll(ev.data);\n  },\n});\n\n" },
      { text: "sendMessage", kind: "identifier" },
      { text: "(" },
      { text: '"Hello from FluxyChat"', kind: "string" },
      { text: ");" },
    ],
  },
  {
    id: "streaming",
    label: "Live Streaming",
    title: "Live streaming events, at any scale.",
    description:
      "Client events fan out reactions to every subscriber in milliseconds. Presence counts update on the same room WebSocket — no separate pub/sub service.",
    icon: Radio,
    code: [
      { text: "const", kind: "keyword" },
      { text: " { sendClientEvent, presenceMembers } = " },
      { text: "useChat", kind: "identifier" },
      { text: "({\n  roomId: " },
      { text: '"live:premiere-7"', kind: "string" },
      { text: ",\n  client,\n  onAnyEvent: (e) => e.type === " },
      { text: '"client_event"', kind: "string" },
      { text: " && render(e),\n});\n\n// one publish, delivered to every subscriber\n" },
      { text: "sendClientEvent", kind: "identifier" },
      { text: "(" },
      { text: '"reaction"', kind: "string" },
      { text: ", { emoji: " },
      { text: '"heart"', kind: "string" },
      { text: " });" },
    ],
  },
  {
    id: "location",
    label: "Real-Time Location",
    title: "Live location, down to the last update.",
    description:
      "Publish foreground position updates to an authenticated room at a safe one-update-per-second ceiling. Connected members receive current tracks, with stale positions expiring automatically.",
    icon: MapPin,
    code: [
      { text: "const", kind: "keyword" },
      { text: " { tracks } = " },
      { text: "useLocation", kind: "identifier" },
      { text: "({ roomId: " },
      { text: '"delivery:42"', kind: "string" },
      { text: " });\n\n" },
      { text: "const", kind: "keyword" },
      { text: " trip = " },
      { text: "locationTrack", kind: "identifier" },
      { text: "(client, " },
      { text: '"delivery:42"', kind: "string" },
      { text: ", {\n  trackId: " },
      { text: '"courier:maya"', kind: "string" },
      { text: ",\n});\n\n" },
      { text: "trip.stop", kind: "identifier" },
      { text: "(); // end the track explicitly" },
    ],
  },
  {
    id: "push",
    label: "Push Notifications",
    title: "Push notifications, even when they're offline.",
    description:
      "When a user is not connected, the Worker delivers the message as a VAPID web push and can fall back to bridged channels such as Slack, Discord, and email digests.",
    icon: Bell,
    code: [
      { text: "const", kind: "keyword" },
      { text: " { requestPermissionAndSubscribe } = " },
      { text: "useWebPush", kind: "identifier" },
      { text: "(client, {\n  swPath: " },
      { text: '"/fluxy-push-sw.js"', kind: "string" },
      { text: ",\n});\n\n" },
      { text: "await", kind: "keyword" },
      { text: " " },
      { text: "requestPermissionAndSubscribe", kind: "identifier" },
      { text: "();\n// offline users get a push; Slack / email fall back." },
    ],
  },
  {
    id: "ai-transport",
    label: "AI Transport",
    title: "Durable AI sessions that survive disconnects.",
    description:
      "Ably-style resilient AI sessions with offset-based event replay. Sessions survive disconnect and device switch — the offset is the contract, not ephemeral UI state.",
    icon: Cpu,
    code: [
      { text: "const", kind: "keyword" },
      { text: " dt = " },
      { text: "createDurableAITransport", kind: "identifier" },
      { text: "();\nconst session = dt." },
      { text: "createSession", kind: "identifier" },
      { text: "(" },
      { text: '"user-1"', kind: "string" },
      { text: ", { deviceId: " },
      { text: '"dev-1"', kind: "string" },
      { text: " });\ndt." },
      { text: "appendEvent", kind: "identifier" },
      { text: "(session.id, " },
      { text: '"message"', kind: "string" },
      { text: ", { text: " },
      { text: '"hello"', kind: "string" },
      { text: " });\nconst replayed = dt." },
      { text: "replay", kind: "identifier" },
      { text: "(session.id, 0);\ndt." },
      { text: "switchDevice", kind: "identifier" },
      { text: "(session.id, " },
      { text: '"dev-2"', kind: "string" },
      { text: ");" },
    ],
  },
  {
    id: "voice",
    label: "Voice AI",
    title: "STT → LLM → TTS on the room WebSocket.",
    description:
      "Production voice pipeline with latency metrics and transport fallback. Starts on realtime WebRTC, steps down to chunked audio or text-only when the network cannot keep up.",
    icon: Mic,
    code: [
      { text: "const", kind: "keyword" },
      { text: " { start, activeTransport } = " },
      { text: "useVoice", kind: "identifier" },
      { text: "({\n  preferredTransport: " },
      { text: '"realtime"', kind: "string" },
      { text: ",\n  autoFallback: " },
      { text: "true", kind: "keyword" },
      { text: ",\n});\n\n" },
      { text: "await", kind: "keyword" },
      { text: " " },
      { text: "start", kind: "identifier" },
      { text: "();\n// realtime → chunked → text_only" },
    ],
  },
  {
    id: "collab",
    label: "FluxyCollab",
    title: "Whiteboard, notes, and kanban in the same room.",
    description:
      "Yjs CRDT updates fan out as server events on the room WebSocket. Notes and boards stay in sync with chat — no separate collab backend.",
    icon: Pen,
    code: [
      { text: "const", kind: "keyword" },
      { text: " { sendClientEvent } = " },
      { text: "useChat", kind: "identifier" },
      { text: "({\n  roomId: " },
      { text: '"planning"', kind: "string" },
      { text: ",\n  client,\n  onServerEvent: (ev) => {\n    if (ev.name === " },
      { text: '"collab.crdt_update"', kind: "string" },
      { text: ") applyYjs(ev.data);\n  },\n});\n\n" },
      { text: "sendClientEvent", kind: "identifier" },
      { text: "(" },
      { text: '"collab.note"', kind: "string" },
      { text: ", { id, text, x, y });" },
    ],
  },
  {
    id: "fluxy-stream",
    label: "FluxyStream",
    title: "Live video with a chat overlay.",
    description:
      "Create an event, provision ingest, and go live from the worker API. HLS playback and chat reactions share the same room.",
    icon: Video,
    code: [
      { text: "const", kind: "keyword" },
      { text: " stream = " },
      { text: "createWorkerFluxyStreamClient", kind: "identifier" },
      { text: "(client);\nconst event = await stream." },
      { text: "createEvent", kind: "identifier" },
      { text: "({\n  title: " },
      { text: '"Keynote"', kind: "string" },
      { text: ",\n  roomId: " },
      { text: '"stage-main"', kind: "string" },
      { text: ",\n});\nawait stream." },
      { text: "provision", kind: "identifier" },
      { text: "(event.id);\nawait stream." },
      { text: "goLive", kind: "identifier" },
      { text: "(event.id);" },
    ],
  },
  {
    id: "game",
    label: "FluxyGame",
    title: "Multiplayer sessions without a game server fleet.",
    description:
      "Matchmaking, authoritative ticks, and AI NPC hooks run on the worker. The game room is the chat room — players talk while state syncs at the edge.",
    icon: Gamepad2,
    code: [
      { text: "const", kind: "keyword" },
      { text: " game = " },
      { text: "createWorkerFluxyGameClient", kind: "identifier" },
      { text: "(client);\nconst { lobbyId } = await game." },
      { text: "matchmake", kind: "identifier" },
      { text: "({\n  roomId: " },
      { text: '"arena-3"', kind: "string" },
      { text: ",\n  playerId: userId,\n});" },
    ],
  },
  {
    id: "iot",
    label: "FluxyIoT",
    title: "Devices, rules, and telemetry beside your users.",
    description:
      "Device shadow, rule engine, and MQTT bridge events reach operators in the dispatch room. Field readings ingest through the worker REST API.",
    icon: Cpu,
    code: [
      { text: "const", kind: "keyword" },
      { text: " iot = " },
      { text: "createWorkerFluxyIoTClient", kind: "identifier" },
      { text: "(client);\nawait iot." },
      { text: "ingestReading", kind: "identifier" },
      { text: "(" },
      { text: '"sensor-7"', kind: "string" },
      { text: ", {\n  sensor: " },
      { text: '"temp"', kind: "string" },
      { text: ",\n  value: 22.4,\n  unit: " },
      { text: '"C"', kind: "string" },
      { text: ",\n});" },
    ],
  },
  {
    id: "fleet",
    label: "Fleet & GPS",
    title: "Live trips, vehicles, and geofences.",
    description:
      "GPS updates arrive as server events while couriers chat in the dispatch room. Geofence alerts and trip state share the same WebSocket.",
    icon: Truck,
    code: [
      { text: "useChat", kind: "identifier" },
      { text: "({\n  roomId: " },
      { text: '"fleet:dispatch"', kind: "string" },
      { text: ",\n  client,\n  onServerEvent: (ev) => {\n    if (ev.name === " },
      { text: '"fleet.gps_update"', kind: "string" },
      { text: ") updateMap(ev.data);\n  },\n});" },
    ],
  },
  {
    id: "spatial",
    label: "Spatial / Twin",
    title: "Digital twin rooms with live overlays.",
    description:
      "Scenes and entities persist on the worker and fan out to connected clients. Field apps and control rooms see the same twin beside chat.",
    icon: Boxes,
    code: [
      { text: "const", kind: "keyword" },
      { text: " twin = " },
      { text: "createWorkerDigitalTwinClient", kind: "identifier" },
      { text: "(client);\nconst scene = await twin." },
      { text: "createScene", kind: "identifier" },
      { text: "({ name: " },
      { text: '"plant-floor"', kind: "string" },
      { text: ", roomId: " },
      { text: '"plant-floor"', kind: "string" },
      { text: " });\nawait twin." },
      { text: "addEntity", kind: "identifier" },
      { text: "(scene.id, {\n  type: " },
      { text: '"pump"', kind: "string" },
      { text: ",\n  position: { x: 0, y: 0, z: 0 },\n  properties: { label: " },
      { text: '"pump-3"', kind: "string" },
      { text: " },\n});" },
    ],
  },
  {
    id: "edu-live",
    label: "FluxyEdu",
    title: "Polls, breakouts, and stage live in one room.",
    description:
      "Classrooms and venues use the same WebSocket as chat. Poll votes, breakout opens, and go-live events arrive as server_event frames — no second subscription.",
    icon: GraduationCap,
    code: [
      { text: "useChat", kind: "identifier" },
      { text: "({\n  roomId: " },
      { text: '"classroom:101"', kind: "string" },
      { text: ",\n  client,\n  onServerEvent: (ev) => {\n    if (ev.name === " },
      { text: '"edu.poll.created"', kind: "string" },
      { text: ") showPoll(ev.data);\n    if (ev.name === " },
      { text: '"edu.breakout.created"', kind: "string" },
      { text: ") openBreakout(ev.data);\n  },\n});" },
    ],
  },
  {
    id: "omnichannel",
    label: "14 channels",
    title: "One inbox across Slack, Discord, and more.",
    description:
      "Unified adapters for Slack, Discord, Telegram, WhatsApp, Teams, and nine more. Same room kernel for in-app chat and bridged channels.",
    icon: ArrowRightLeft,
    code: [
      { text: "await", kind: "keyword" },
      { text: " adapter." },
      { text: "send", kind: "identifier" },
      { text: "({ platform: " },
      { text: '"slack"', kind: "string" },
      { text: ", channelId, blocks });\n// same message fans to in-app + bridged" },
    ],
  },
] as const;

export function getRealtimeFeature(id: RealtimeFeatureId): RealtimeFeature {
  const feature = REALTIME_FEATURES.find((item) => item.id === id);
  if (!feature) throw new Error(`Unknown realtime feature: ${id}`);
  return feature;
}
