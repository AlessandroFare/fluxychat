export interface HistoryMessage {
  id: number | string;
  createdAt: string;
  roomId?: string;
  userId?: string;
  content?: string;
  kind?: string;
  senderId?: string;
  parentId?: number | string | null;
  editedAt?: string | null;
  deletedAt?: string | null;
  mentions?: string[];
  streaming?: boolean;
  clientMessageId?: string;
  attachments?: { kind: string; url: string; name?: string }[];
  metadata?: Record<string, unknown>;
  replyToId?: string;
  data?: unknown;
}

const DEFAULT_HISTORY_LIMIT = 50;
export const MAX_HISTORY_LIMIT = 500;

export function sortMessagesChronological<T extends HistoryMessage>(messages: T[]): T[] {
  return [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function mergeMessagesChronological<T extends HistoryMessage>(existing: T[], incoming: T[]): T[] {
  const byId = new Map<string, T>();
  for (const msg of [...incoming, ...existing]) {
    const key = String(msg.id);
    if (key === 'undefined' || key === 'NaN') continue;
    const prev = byId.get(key);
    byId.set(key, prev ? { ...prev, ...msg } : msg);
  }
  return sortMessagesChronological([...byId.values()]);
}

export function clampHistoryLimit(limit?: number): number {
  const n = limit ?? DEFAULT_HISTORY_LIMIT;
  if (!Number.isFinite(n) || n < 1) return DEFAULT_HISTORY_LIMIT;
  return Math.min(Math.floor(n), MAX_HISTORY_LIMIT);
}
