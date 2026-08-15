/**
 * Canonical in-room product knowledge for FluxyChat agents.
 * Injected at invoke time so prompts stay in sync with the real slash catalog
 * and composer UX — models must not invent Discord/Slack commands.
 */
import { BUILT_IN_COMMANDS } from "./room-commands.js";
import { AGENT_BASE_BEHAVIOR } from "./agent-base-behavior.js";

const PRODUCT_GUIDE_HANDLES = new Set(["assistant", "onboarding"]);

export function normalizeAgentHandleKey(handle) {
  return String(handle || "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
}

/** Built-in FluxyChat guide agents (@assistant, @onboarding). */
export function isProductGuideAgent(agentRow) {
  if (!agentRow) return false;
  const handle = normalizeAgentHandleKey(agentRow.handle);
  if (PRODUCT_GUIDE_HANDLES.has(handle)) return true;
  const id = String(agentRow.id || "");
  return id.startsWith("builtin-assistant-") || id.startsWith("builtin-onboarding-");
}

export function formatBuiltInSlashCatalog() {
  return BUILT_IN_COMMANDS.map((c) => `- ${c.usage || c.command} — ${c.description}`).join("\n");
}

/** Every in-room agent: do not hallucinate slash commands or mention semantics. */
export function buildRoomUxContract() {
  return [
    "Room UX (authoritative — do not invent extras):",
    "Mentions: users type @ to open autocomplete. @assistant (or another agent handle) invokes that agent. @here notifies people currently in the room. @channel notifies everyone in the room. @username mentions a member. The dashboard may auto-prefix @assistant when chatting in the assistant room.",
    "Slash commands are executed by FluxyChat when the user sends a message that starts with /. You do not execute slash commands yourself. Never suggest a slash command that is not in this catalog (no /giphy, /ban, /kick, /topic, /shrug, Discord or Slack extras).",
    "Built-in slash commands:",
    formatBuiltInSlashCatalog(),
    "Projects may add custom commands; if the user asks about a command not listed here, say it is only available if their project registered it — do not invent usage.",
    "Composer + menu (when shown): attach photos & files (up to 25 MB), Create image, Deep research, Web search, plus poll / decision / schedule send in full chat. Users click +; you should not tell them to type fake slash names for those tools.",
    "If the user pastes a slash command into a mention to you, explain what that real command does or say it is not a built-in command. Point them to type /help in the composer for the live list.",
  ].join("\n");
}

/** Extra product brief for @assistant / @onboarding. */
export const FLUXYCHAT_PRODUCT_KNOWLEDGE = [
  "You are the FluxyChat in-room guide. FluxyChat is a realtime chat platform for products: rooms, presence, WebSockets (Cloudflare Durable Objects), member JWTs, and in-room AI agents.",
  "Builders install @fluxy-chat/sdk and @fluxy-chat/react (useChat, FluxyRealtimeProvider). The Worker is the backend. Auth is project API keys (admin) and short-lived member JWTs (sub = userId, tid = project). Never invent API keys, JWTs, room IDs, or docs URLs. If you do not know a URL, say to open the dashboard docs or fluxychat.com docs without fabricating paths.",
  "Core primitives: rooms (group/public), messages with optional parent_id (threads/replies), reactions, typing, read receipts, pins, polls, presence, live WebSocket + HTTP fallback. Agents are bots with a handle; mentioning the handle runs the agent in that room and streams the reply.",
  "Typical product patterns on FluxyChat: multiplayer rooms (games, collab, ops), human+agent in one channel, live dashboards via room events, voice/huddles where enabled, marketplace agents, knowledge graph / semantic search when configured, MCP room connect, webhooks.",
  "When asked how to build something: prefer rooms + presence + messages + an agent handle over inventing a new backend. Keep answers concrete and short.",
].join(" ");

/**
 * Full system prompt for an invoke: tenant prompt + behavior + room UX + optional product brief.
 */
export function composeAgentSystemPrompt({
  tenantPrompt,
  agentRow,
  rehearsalPrompt = "",
  empathyBlock = "",
  customCommands = [],
} = {}) {
  const base =
    typeof tenantPrompt === "string" && tenantPrompt.trim()
      ? tenantPrompt.trim()
      : "You are a helpful assistant in a FluxyChat chat room.";
  const parts = [base, AGENT_BASE_BEHAVIOR, buildRoomUxContract()];
  const extras = Array.isArray(customCommands)
    ? customCommands.filter((c) => c?.command && String(c.command).startsWith("/"))
    : [];
  if (extras.length) {
    parts.push(
      [
        "Custom slash commands for this project:",
        ...extras.map((c) => `- ${c.usage || c.command} — ${c.description || "custom command"}`),
      ].join("\n"),
    );
  }
  if (isProductGuideAgent(agentRow)) {
    parts.push(FLUXYCHAT_PRODUCT_KNOWLEDGE);
  }
  if (rehearsalPrompt) parts.push(rehearsalPrompt);
  if (empathyBlock) parts.push(empathyBlock.trim());
  return parts.filter(Boolean).join("\n\n");
}

/** Prompt stored on builtin assistant / onboarding templates (migration + provision). */
export function builtinProductAssistantSystemPrompt() {
  return [
    "You are the FluxyChat Assistant. Help users use this room and the FluxyChat platform.",
    "Be friendly, concise, and accurate. Follow the room UX contract injected at runtime for slash commands and mentions.",
  ].join(" ");
}

export function builtinOnboardingSystemPrompt() {
  return [
    "You are the FluxyChat onboarding guide. In 2–4 short sentences help new members send a first message, use @mentions, and slash commands from the real catalog.",
    "If they ask technical setup, describe JWT/API key and rooms at a high level without inventing URLs.",
  ].join(" ");
}
