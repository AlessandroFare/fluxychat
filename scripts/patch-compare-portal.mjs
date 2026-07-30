#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "apps/dashboard/lib/compare-providers.ts");
const src = fs.readFileSync(target, "utf8").replace(/\r\n/g, "\n");

const portalByLabel = {
  "Edge-native (Cloudflare Workers + DO + D1)": "Managed SaaS — not Workers/DO-first",
  "Multi-platform adapters (14 platforms)": "Web/React SDK — not 14 channel adapters",
  "AI-native streaming (markdown, tool calling)": "Core — streaming agents + tool calls",
  "MCP client integration": "MCP apps / tool server integrations",
  "LLM middleware pipeline": "Middleware hooks in SDK",
  "Durable agent execution (WorkflowAgent)": "Hosted agent runtime",
  "In-app chat + operator console": "Hosted Portal dashboard",
  "Headless SDK (optimistic sends, reconnect state)": "Excellent DX — package split, SSR-safe hooks",
  "Agent tool events on room WebSocket": "Same room timeline",
  "Message templates + member preferences API": "Templates + member prefs",
  "Reconnect, replay, and delivery state in SDK": "connectionState + replay patterns",
  "Read receipts / unread badges": "Inbox + read watermarks",
  "In-app notifications (mentions, DMs)": "Unified inbox feed",
  "Message middleware (validate / filter / enrich)": "Server-side hooks",
  "Live streaming & broadcast (HLS, polls, highlights)": "Not core (chat-first product)",
  "Real-time collab (Yjs / CRDT whiteboard)": "Not core",
  "Game multiplayer (matchmaking, replay, NPC)": "N/A",
  "IoT & device sync (MQTT, shadow, rules)": "N/A",
  "Fleet & live location tracking": "N/A",
  "Spatial / digital twin rooms": "N/A",
  "Voice + AI transport pipeline": "Voice varies — chat-first SDK",
  "Cross-channel continuity & customer memory": "Inbox + continuity focus",
  "Pricing surprises at scale": "Hosted SaaS tiers",
  "Self-host / on your own account": "Proprietary cloud — no MIT self-host",
  "Socket fleet / VPS to operate": "Managed vendor infra",
  "Next.js on Vercel + realtime (typical split)": "Frontend-agnostic hosted API",
};

function extractRows(text) {
  const start = text.indexOf("export const COMPARE_ROWS");
  const end = text.indexOf("\n];", start);
  const body = text.slice(start, end);
  const blocks = body.split("\n  {\n").slice(1);
  return blocks.map((block) => {
    const fields = {};
    for (const line of block.split("\n")) {
      const m = line.match(/^\s*(\w+): "([^"]*)",?\s*$/);
      if (m) fields[m[1]] = m[2];
    }
    if (!fields.label) throw new Error(`row missing label in block: ${block.slice(0, 80)}`);
    return fields;
  });
}

const existing = extractRows(src);
const rows = existing.map((row) => ({
  ...row,
  portal: portalByLabel[row.label] ?? row.portal ?? "Varies",
}));

if (!rows.some((r) => r.label.includes("Omnichannel inbox"))) {
  rows.push({
    label: "Omnichannel inbox (mentions, unread, follow-ups)",
    portal: "Unified inbox + onItem over user channel",
    stream: "Separate feeds product",
    ably: "N/A",
    pusher: "N/A",
    fluxy: "useInbox items feed + REST /inbox + console badge",
  });
}
if (!rows.some((r) => r.label.includes("MIT license"))) {
  rows.push({
    label: "MIT license — read and deploy the full stack",
    portal: "Proprietary hosted service",
    stream: "Proprietary cloud",
    ably: "Managed-first",
    pusher: "Managed-first",
    fluxy: "MIT monorepo — Worker, SDK, console, no vendor lock-in",
  });
}

const order = ["label", "portal", "stream", "ably", "pusher", "fluxy"];
const rendered = rows
  .map(
    (row) =>
      `  {\n${order
        .filter((k) => row[k] != null)
        .map((k) => `    ${k}: "${row[k]}",`)
        .join("\n")}\n  }`,
  )
  .join(",\n");

const next = src.replace(
  /export const COMPARE_ROWS: readonly CompareRow\[\] = \[[\s\S]*?\n\];/,
  `export const COMPARE_ROWS: readonly CompareRow[] = [\n${rendered},\n];`,
);

fs.writeFileSync(target, next.replace(/\n/g, "\r\n"));
console.log(`patched ${rows.length} compare rows with portal column`);
