import type { AIMessage } from "./providers";

export interface PruneMessagesOptions {
  messages: readonly AIMessage[];
  /** Maximum number of messages to keep. Trims from start. */
  maxMessages?: number;
  /** Maximum total characters across all messages. Trims from start. */
  maxChars?: number;
  /** Roles to remove entirely. */
  removeRoles?: AIMessage["role"][];
  /** If true, removes messages with empty content. */
  removeEmpty?: boolean;
  /** Number of recent messages to always preserve regardless of other limits. */
  preserveLast?: number;
}

/**
 * Prunes an array of messages to fit within constraints.
 * Always preserves the system message (if present).
 */
export function pruneMessages(options: PruneMessagesOptions): AIMessage[] {
  let result = [...options.messages];

  // Remove specified roles (never remove system)
  if (options.removeRoles?.length) {
    const roles = new Set(options.removeRoles);
    roles.delete("system");
    result = result.filter((m) => !roles.has(m.role));
  }

  // Remove empty messages (never remove system even if empty)
  if (options.removeEmpty) {
    result = result.filter((m) => m.role === "system" || (m.content?.length ?? 0) > 0);
  }

  // Preserve last N
  const preserve = Math.max(0, options.preserveLast ?? 0);

  // Max messages — trim from start, preserving system + recent
  if (options.maxMessages !== undefined && result.length > options.maxMessages) {
    const systemIdx = result.findIndex((m) => m.role === "system");
    const system = systemIdx >= 0 ? [result[systemIdx]] : [];
    const nonSystem = systemIdx >= 0 ? result.filter((_, i) => i !== systemIdx) : [...result];
    const keepCount = Math.max(preserve, options.maxMessages - system.length);
    const kept = nonSystem.slice(-keepCount);
    result = [...system, ...kept];
  }

  // Max chars — trim from start, preserving system + recent
  if (options.maxChars !== undefined) {
    const systemIdx = result.findIndex((m) => m.role === "system");
    const system = systemIdx >= 0 ? [result[systemIdx]] : [];
    const nonSystem = systemIdx >= 0 ? result.filter((_, i) => i !== systemIdx) : [...result];

    let chars = 0;
    const preserved: AIMessage[] = [];
    for (let i = nonSystem.length - 1; i >= 0; i--) {
      const msg = nonSystem[i];
      const next = chars + (msg.content?.length ?? 0);
      if (next > options.maxChars && i >= nonSystem.length - preserve) {
        preserved.unshift(msg);
        break;
      }
      if (next > options.maxChars) break;
      chars = next;
      preserved.unshift(msg);
    }
    result = [...system, ...preserved];
  }

  return result;
}
