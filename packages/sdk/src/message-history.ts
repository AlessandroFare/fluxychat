/** Minimal fields required for history merge/sort. */
export interface HistoryMessage {
  id: number;
  createdAt: string;
  roomId?: string;
  userId?: string;
  content?: string;
  senderId?: string;
  parentId?: number | null;
  editedAt?: string | null;
  deletedAt?: string | null;
  mentions?: string[];
  streaming?: boolean;
  attachments?: { kind: string; url: string; name: string }[];
  poll?: unknown;
  decision?: unknown;
}

const DEFAULT_HISTORY_LIMIT = 50;
export const MAX_HISTORY_LIMIT = 500;

export function sortMessagesChronological<T extends HistoryMessage>(messages: T[]): T[] {
  return [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function contentLength(msg: HistoryMessage): number {
  return String(msg.content ?? "").length;
}

/** Same-id merge: later row wins fields, but never replace longer text with a shorter stub. */
function mergeAttachments<T extends HistoryMessage>(prev: T, msg: T): T["attachments"] {
  const incoming = msg.attachments;
  const existing = prev.attachments;
  if (Array.isArray(incoming) && incoming.length > 0) return incoming;
  if (Array.isArray(existing) && existing.length > 0) return existing;
  return incoming ?? existing;
}

function keepIfMissing<T>(incoming: T | undefined, existing: T | undefined): T | undefined {
  if (incoming != null) return incoming;
  return existing;
}

export function mergeSameIdHistoryMessage<T extends HistoryMessage>(prev: T, msg: T): T {
  const prevLen = contentLength(prev);
  const msgLen = contentLength(msg);
  const rich = {
    attachments: mergeAttachments(prev, msg),
    poll: keepIfMissing(msg.poll, prev.poll),
    decision: keepIfMissing(msg.decision, prev.decision),
  };
  if (msgLen > prevLen) return { ...prev, ...msg, ...rich };
  if (prevLen > msgLen) {
    return {
      ...prev,
      ...msg,
      content: prev.content,
      streaming: prev.streaming,
      ...rich,
    };
  }
  return { ...prev, ...msg, ...rich };
}

export function mergeMessagesChronological<T extends HistoryMessage>(
  existing: T[],
  incoming: T[],
): T[] {
  const byId = new Map<number, T>();
  for (const msg of [...incoming, ...existing]) {
    if (!Number.isFinite(msg.id)) continue;
    const prev = byId.get(msg.id);
    byId.set(msg.id, prev ? mergeSameIdHistoryMessage(prev, msg) : msg);
  }
  return sortMessagesChronological([...byId.values()]);
}

export function clampHistoryLimit(limit?: number): number {
  const n = limit ?? DEFAULT_HISTORY_LIMIT;
  if (!Number.isFinite(n) || n < 1) return DEFAULT_HISTORY_LIMIT;
  return Math.min(Math.floor(n), MAX_HISTORY_LIMIT);
}
