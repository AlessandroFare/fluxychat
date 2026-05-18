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
}

const DEFAULT_HISTORY_LIMIT = 50;
export const MAX_HISTORY_LIMIT = 500;

export function sortMessagesChronological<T extends HistoryMessage>(messages: T[]): T[] {
  return [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function mergeMessagesChronological<T extends HistoryMessage>(
  existing: T[],
  incoming: T[],
): T[] {
  const byId = new Map<number, T>();
  for (const msg of [...incoming, ...existing]) {
    if (!Number.isFinite(msg.id)) continue;
    const prev = byId.get(msg.id);
    byId.set(msg.id, prev ? { ...prev, ...msg } : msg);
  }
  return sortMessagesChronological([...byId.values()]);
}

export function clampHistoryLimit(limit?: number): number {
  const n = limit ?? DEFAULT_HISTORY_LIMIT;
  if (!Number.isFinite(n) || n < 1) return DEFAULT_HISTORY_LIMIT;
  return Math.min(Math.floor(n), MAX_HISTORY_LIMIT);
}
