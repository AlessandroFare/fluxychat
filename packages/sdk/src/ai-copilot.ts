export interface AiKnowledgeEntry {
  name: string;
  description?: string;
  value: unknown;
}

export interface AiToolEntry {
  name: string;
  description?: string;
}

export interface AiChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const KNOWLEDGE_MAX = 8;
const VALUE_MAX = 2000;

export function serializeKnowledge(entries: AiKnowledgeEntry[]): string {
  return entries
    .slice(0, KNOWLEDGE_MAX)
    .map((entry) => {
      let raw = "";
      try {
        raw = typeof entry.value === "string" ? entry.value : JSON.stringify(entry.value);
      } catch {
        raw = String(entry.value);
      }
      return `${entry.name}: ${raw.slice(0, VALUE_MAX)}`;
    })
    .join("\n");
}

/** Keyless copilot (LB-AI). Does not write the room chat timeline. */
export function mockCopilotReply(input: {
  userText: string;
  knowledge: AiKnowledgeEntry[];
  tools: AiToolEntry[];
}): string {
  const text = String(input.userText || "").trim().slice(0, 500);
  const facts = serializeKnowledge(input.knowledge);
  const tools = input.tools.map((t) => t.name).join(", ");
  const parts = [`Keyless copilot mock (not invokeAgent). You said: ${text || "(empty)"}`];
  if (facts) parts.push(`Knowledge:\n${facts.slice(0, 800)}`);
  if (tools) parts.push(`Registered tools: ${tools}`);
  parts.push("Room-peer agents still use invokeAgent on the chat timeline. Workflows POST /rooms/:id/feeds.");
  return parts.join("\n\n");
}
