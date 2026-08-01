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

export interface BranchPolicyResult {
  allowed: boolean;
  reason?: "not_authenticated" | "not_found" | "forbidden_anchor" | "blocked_by_other_users";
}

/** Client-side mirror of worker branch policy (1:1 agent rooms + no third-party tails). */
export function canBranchFromMessage(
  messages: FluxyChatMessage[],
  fromMessageId: number,
  userId: string | undefined,
  agentId: string,
): BranchPolicyResult {
  if (!userId) return { allowed: false, reason: "not_authenticated" };
  const idx = messages.findIndex((m) => m.id === fromMessageId);
  if (idx < 0) return { allowed: false, reason: "not_found" };

  const anchor = messages[idx];
  const tail = messages.slice(idx);
  const anchorIsUser = anchor.userId === userId;
  const anchorIsAgent = Boolean(agentId && anchor.userId === agentId);
  if (!anchorIsUser && !anchorIsAgent) {
    return { allowed: false, reason: "forbidden_anchor" };
  }

  for (const row of tail) {
    if (row.userId === userId) continue;
    if (agentId && row.userId === agentId) continue;
    return { allowed: false, reason: "blocked_by_other_users" };
  }

  return { allowed: true };
}
