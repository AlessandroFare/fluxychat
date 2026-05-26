export interface CompareRow {
  label: string;
  stream: string;
  ably: string;
  pusher: string;
  fluxy: string;
}

export const COMPARE_ROWS: readonly CompareRow[] = [
  {
    label: "Edge-native (Cloudflare Workers + DO + D1)",
    stream: "Managed cloud",
    ably: "Managed cloud",
    pusher: "Managed cloud",
    fluxy: "Designed for Workers + DO + D1",
  },
  {
    label: "In-app chat + operator console",
    stream: "Separate product areas",
    ably: "Console + APIs",
    pusher: "Channels dashboard",
    fluxy: "First-party console in monorepo",
  },
  {
    label: "Headless SDK (optimistic sends, reconnect state)",
    stream: "Strong SDKs",
    ably: "Strong SDKs",
    pusher: "Channels SDKs",
    fluxy: "@fluxy-chat/sdk + vanilla store",
  },
  {
    label: "Agent tool events on room WebSocket",
    stream: "Varies",
    ably: "Separate products",
    pusher: "N/A",
    fluxy: "tool_call / tool_result on same timeline",
  },
  {
    label: "MIT self-host on your Cloudflare account",
    stream: "Proprietary",
    ably: "Managed-first",
    pusher: "Managed-first",
    fluxy: "Full monorepo, wrangler deploy",
  },
  {
    label: "Message templates + member preferences API",
    stream: "Varies",
    ably: "N/A",
    pusher: "Limited",
    fluxy: "POST /templates, member prefs PATCH",
  },
];

export const DECISION_FLOW = [
  {
    question: "Need SMS/WhatsApp to phones?",
    yes: "Use a telco API (e.g. Sent) alongside FluxyChat for in-app threads.",
    no: "Continue ↓",
  },
  {
    question: "Need only pub/sub fan-out (no message history UI)?",
    yes: "Consider Ably/Pusher-style channels.",
    no: "FluxyChat fits: rooms, history, presence, agents.",
  },
  {
    question: "Must run on your Cloudflare account?",
    yes: "MIT self-host FluxyChat.",
    no: "Try hosted beta or self-host — same API shape.",
  },
] as const;
