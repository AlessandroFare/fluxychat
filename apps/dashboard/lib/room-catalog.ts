export type RoomStatus = "Core" | "Module" | "Worker" | "Labs";
export type RoomGlyph = "orbit" | "grid" | "wave" | "spark" | "arch" | "checker";
export type RoomPalette = "orange" | "green" | "blue" | "yellow" | "violet";

export interface RoomCatalogEntry {
  slug: string;
  name: string;
  tag: string;
  status: RoomStatus;
  palette: RoomPalette;
  glyph: RoomGlyph;
  summary: string;
  lede: string;
  description: string;
  surfaces: [string, string, string];
  notFor: string;
  consoleHref?: string;
  docsSlug?: string;
  featured?: boolean;
}

/**
 * The public room catalog. Every entry is backed by a Worker module or an
 * existing console surface; labs stay labelled labs. Keep names and claims in
 * sync with `docs/platform/vertical-industries` and the console pages.
 */
export const ROOM_CATALOG: RoomCatalogEntry[] = [
  {
    slug: "chat-core",
    name: "In-App Chat",
    tag: "Chat core",
    status: "Core",
    palette: "orange",
    glyph: "orbit",
    summary: "Rooms, presence, history, and agents on one WebSocket.",
    lede: "A room is one Durable Object: state, presence, history, and agent streams in one place. Hosted beta or MIT self-host.",
    description:
      "The baseline room. Messages, presence, typing, delivery, polls, and invokeAgent share a socket. Reconnect resumes from a D1 cursor instead of an empty screen.",
    surfaces: [
      "Messages, typing, and presence on one socket",
      "History in D1; reconnect from a cursor",
      "Agents stream on the same timeline as humans",
    ],
    notFor:
      "Not a helpdesk, a social graph, or an end-to-end encrypted messenger. Hosted is beta; pin SDK versions.",
    consoleHref: "/rooms",
    docsSlug: "chat-only",
    featured: true,
  },
  {
    slug: "fluxy-stream",
    name: "FluxyStream",
    tag: "Live streaming",
    status: "Worker",
    palette: "orange",
    glyph: "spark",
    summary: "Broadcast, HLS, and chat overlay on the same room.",
    lede: "Stream events, viewers, polls, and chat share a room. The media path is HLS; the room stays the control plane.",
    description:
      "Create an event, go live, and keep the conversation on the same room. Polls, highlights, gifts, and moderation run on room events while HLS handles playback.",
    surfaces: [
      "Events, viewers, and chat on one room",
      "HLS playback with no second control plane",
      "Polls, highlights, and co-host state as events",
    ],
    notFor:
      "Not a CDN or a full studio. Media and HLS costs depend on your Cloudflare account.",
    consoleHref: "/stream",
    featured: true,
  },
  {
    slug: "fluxy-game",
    name: "FluxyGame",
    tag: "Games",
    status: "Worker",
    palette: "green",
    glyph: "grid",
    summary: "Matchmaking, room ticks, and leaderboards.",
    lede: "Matchmaking writes D1 and the match runs on the room. Ticks, leaderboards, parties, and NPC calls stay server-authoritative.",
    description:
      "A multiplayer surface for rooms: queue players, start a match, tick state, and write the leaderboard. The same room carries chat and the game feed.",
    surfaces: [
      "Matchmaking and parties persisted in D1",
      "Server-authoritative room ticks",
      "Leaderboards, quests, and NPC tools as events",
    ],
    notFor:
      "Not a game server fleet, anti-cheat service, or asset pipeline. Bring your own client.",
    consoleHref: "/game",
    featured: true,
  },
  {
    slug: "fluxy-iot",
    name: "FluxyIoT",
    tag: "Devices",
    status: "Worker",
    palette: "blue",
    glyph: "orbit",
    summary: "HTTP ingest, device shadow, and room fan-out.",
    lede: "Devices post telemetry over HTTP. The room keeps a shadow and fans updates to people and agents on the socket.",
    description:
      "Register a device, post telemetry, and keep the last known state in the room. Operators and agents see the same shadow without polling a separate broker.",
    surfaces: [
      "HTTP ingest with per-device identity",
      "Device shadow stored with the room",
      "Fan-out to operators and agents on the socket",
    ],
    notFor:
      "Not an MQTT broker or a fleet-management suite. HTTP ingest and device shadow only.",
    consoleHref: "/iot",
    featured: true,
  },
  {
    slug: "fleet-gps",
    name: "Fleet & GPS",
    tag: "Real-time location",
    status: "Worker",
    palette: "yellow",
    glyph: "wave",
    summary: "Live GPS tracks, trips, and delivery status.",
    lede: "Drivers or devices publish positions. The room keeps trips, stops, and status so an operator can follow the route live.",
    description:
      "A location surface on the same room: start a trip, publish a position, follow the track, and close the delivery. History is queryable from D1.",
    surfaces: [
      "Live positions and trip state on the room",
      "Stops, status, and delivery events",
      "Track history in D1",
    ],
    notFor:
      "Not dispatch, routing, or a map-tile bundle. Bring your map provider and geocoder.",
    consoleHref: "/fleet",
    featured: true,
  },
  {
    slug: "bridges",
    name: "Bridges",
    tag: "Channels",
    status: "Module",
    palette: "blue",
    glyph: "grid",
    summary: "Slack, Discord, Telegram, WhatsApp, Teams into one room.",
    lede: "You create the vendor app and paste the token. Messages land in the room; replies go back over the bridge.",
    description:
      "A bridge connects an external channel to a room. The room remains the transcript, while the vendor app and signing secret stay under your control.",
    surfaces: [
      "Slack, Discord, Telegram, WhatsApp, and Teams",
      "Vendor apps and tokens you own",
      "Room history shared across the bridge",
    ],
    notFor:
      "Not an omnichannel helpdesk or a public marketplace app. You provision the vendor app.",
    consoleHref: "/bridges",
  },
  {
    slug: "fluxy-collab",
    name: "FluxyCollab",
    tag: "Docs and cursors",
    status: "Module",
    palette: "green",
    glyph: "wave",
    summary: "Whiteboard, notes, kanban, and cursors on the room.",
    lede: "Yjs documents attach to the same room object. Live cursors and comments share the room's presence.",
    description:
      "A collaboration module for rooms: an Excalidraw board, notes, kanban, and comments backed by Yjs. Mount the document socket only when you use it.",
    surfaces: [
      "Excalidraw board and notes per room",
      "Live cursors on the room's presence",
      "Kanban and comments as room content",
    ],
    notFor:
      "Not a full docs suite or an offline-first editor. Yjs adds a binary socket when mounted.",
    consoleHref: "/collab",
  },
  {
    slug: "voice-ai",
    name: "Voice AI",
    tag: "Voice",
    status: "Module",
    palette: "violet",
    glyph: "spark",
    summary: "A voice stage roster and clips on the timeline.",
    lede: "joinVoiceStage is signaling. Live audio is LiveKit when configured; recorded clips land as room messages.",
    description:
      "A voice surface without pretending to be an SFU: signaling and a roster live with the room, media goes to LiveKit, and clips return as messages.",
    surfaces: [
      "Stage roster and signaling on the room",
      "Live media through LiveKit",
      "Voice clips back on the room timeline",
    ],
    notFor:
      "Not an SFU we sell. Huddles media stays labs; you bring LiveKit and its meter.",
    consoleHref: "/voice-ai",
  },
  {
    slug: "push-notifications",
    name: "Push Notifications",
    tag: "Notifications",
    status: "Module",
    palette: "orange",
    glyph: "spark",
    summary: "Web push, mentions, digests, and quiet hours.",
    lede: "Mentions, DMs, and digests reach the browser. Quiet hours and per-room preferences decide what gets through.",
    description:
      "A notification module for the room: VAPID web push, mention and DM triggers, batched digests, quiet hours, and an explicit permission flow.",
    surfaces: [
      "Web push with VAPID keys you own",
      "Mention, DM, and digest triggers",
      "Quiet hours and per-room preferences",
    ],
    notFor:
      "Not an email marketing suite. Push depends on browser permission and your vendor keys.",
    consoleHref: "/notifications",
    docsSlug: "learn/offline-notify-in-app-plus-sms",
  },
  {
    slug: "fluxy-edu",
    name: "FluxyEdu",
    tag: "Classrooms",
    status: "Worker",
    palette: "violet",
    glyph: "arch",
    summary: "Polls, breakouts, attendance, and gated AI drafts.",
    lede: "A classroom is a room. Attendance, polls, breakouts, and a teacher-approved AI assistant run on the timeline.",
    description:
      "A teaching surface on the room: attendance heartbeats, one-vote polls, breakout groups, and grading drafts that stay unpublished until a teacher signs off.",
    surfaces: [
      "Attendance and room events",
      "Polls, quizzes, and breakout groups",
      "AI drafts gated by a teacher",
    ],
    notFor:
      "No FERPA or COPPA certification and no LMS LTI. Video is Realtime SFU when the secrets are set.",
    consoleHref: "/edu",
  },
  {
    slug: "spatial-twin",
    name: "Spatial / Twin",
    tag: "Spatial",
    status: "Labs",
    palette: "green",
    glyph: "orbit",
    summary: "Digital-twin scenes and AR overlays on a room.",
    lede: "A room can carry a scene graph and AR overlay state. It stays a lab until a design partner takes it to production.",
    description:
      "Spatial experiments: digital-twin scenes, entity transforms, and AR overlays anchored to a room. Useful for prototypes, not a metaverse platform.",
    surfaces: [
      "Scene graph stored with the room",
      "Entity transforms and presence",
      "AR overlay state for prototypes",
    ],
    notFor:
      "Labs. No production SLA, no headset SDK, and no promise that the scene format will not change.",
    consoleHref: "/spatial",
  },
  {
    slug: "ai-transport",
    name: "AI Transport",
    tag: "Transport",
    status: "Labs",
    palette: "blue",
    glyph: "wave",
    summary: "WebTransport negotiation with a WebSocket fallback.",
    lede: "Try WebTransport where the browser allows it, then fall back to the room socket. Health and negotiation stay visible.",
    description:
      "A transport lab for lower-latency experiments. It negotiates WebTransport, reports health, and falls back to WebSocket without changing the room API.",
    surfaces: [
      "WebTransport negotiation and health",
      "Explicit WebSocket fallback",
      "The same room API above the transport",
    ],
    notFor:
      "Labs. It does not replace the room socket today, and browser support is uneven.",
    consoleHref: "/transport",
  },
];

export const FEATURED_ROOMS = ROOM_CATALOG.filter((room) => room.featured);
export const SUPPORTING_ROOMS = ROOM_CATALOG.filter((room) => !room.featured);

export function roomBySlug(slug: string): RoomCatalogEntry | null {
  return ROOM_CATALOG.find((room) => room.slug === slug) ?? null;
}

export function roomPageHref(room: RoomCatalogEntry): string {
  return `/solutions/${room.slug}`;
}

export const ROOM_STATUS_LEGEND: Record<RoomStatus, string> = {
  Core: "Ships on every plan",
  Worker: "Runs on the Worker and D1",
  Module: "Attach when you need it",
  Labs: "Prototype; no GA promise",
};
