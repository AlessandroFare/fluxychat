import type { FluxyChatMessage } from "@fluxy-chat/sdk";

/** Strip composer tool tags for edit/retry display. */
export function stripComposerToolTags(content: string): string {
  return content
    .replace(/^@[\w.-]+\s+/i, "")
    .replace(/\[(web-search|deep-research)\]\s*/i, "")
    .replace(/^Search the web for current, factual information about:\s*/i, "")
    .replace(/^Conduct thorough, multi-step research on:\s*/i, "")
    .replace(/\.\s*Summarize findings.*$/i, "")
    .replace(/\.\s*Structure your answer.*$/i, "")
    .trim();
}

export function detectToolFromMessageContent(
  content: string,
): "web-search" | "deep-research" | null {
  if (/\[web-search\]/i.test(content)) return "web-search";
  if (/\[deep-research\]/i.test(content)) return "deep-research";
  return null;
}

export function findPriorUserMessage(
  messages: FluxyChatMessage[],
  fromIndex: number,
  agentId: string,
): FluxyChatMessage | null {
  for (let i = fromIndex - 1; i >= 0; i--) {
    const row = messages[i];
    if (row.userId !== agentId) return row;
  }
  return null;
}

export function messageIdsFromIndex(
  messages: FluxyChatMessage[],
  fromIndex: number,
  inclusive: boolean,
): number[] {
  const start = inclusive ? fromIndex : fromIndex + 1;
  if (start < 0 || start >= messages.length) return [];
  return messages
    .slice(start)
    .map((m) => m.id)
    .filter((id): id is number => id != null);
}
