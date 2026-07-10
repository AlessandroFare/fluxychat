import type { LucideIcon } from "lucide-react";
import { Bell, MapPin, MessageSquare, Radio } from "lucide-react";

export type RealtimeFeatureId = "chat" | "streaming" | "location" | "push";
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
      "The FluxyChat SDK gives you a fully real-time room layer. Messages are delivered instantly to every connected client, with presence tracking, read receipts, threads, and reactions built in.",
    icon: MessageSquare,
    code: [
      { text: "const", kind: "keyword" },
      { text: " { messages, sendMessage, reactions } = " },
      { text: "useChat", kind: "identifier" },
      { text: "({\n  roomId: " },
      { text: '"chat:room-42"', kind: "string" },
      { text: ",\n});\n\n" },
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
      "One publisher can reach every viewer instantly. FluxyChat client events fan out reactions to every connected subscriber in milliseconds, with live presence counts built in.",
    icon: Radio,
    code: [
      { text: "const", kind: "keyword" },
      { text: " { sendClientEvent, presenceMembers } = " },
      { text: "useChat", kind: "identifier" },
      { text: "({\n  roomId: " },
      { text: '"live:premiere-7"', kind: "string" },
      { text: ",\n  onAnyEvent: (e) => e.type === " },
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
] as const;

export function getRealtimeFeature(id: RealtimeFeatureId): RealtimeFeature {
  const feature = REALTIME_FEATURES.find((item) => item.id === id);
  if (!feature) throw new Error(`Unknown realtime feature: ${id}`);
  return feature;
}
