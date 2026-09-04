/** Chat reply threads on `parentId`. Not comment pins (`useThreads` / `/comment-threads`). */

export const MAX_CHAT_THREAD_DEPTH = 8;

export interface FluxyRoomThread {
  id: number;
  roomId: string;
  parentThreadId: number | null;
  rootThreadId: number;
  depth: number;
  spawnedBy: { id: string };
  messageCount: number;
  createdAt: string;
  lastReplyAt: string;
  lastReplyMessageId: number;
  preview?: string;
}

export interface FluxyThreadListQuery {
  /** Immediate children of this message. Empty / omit = root-level threads. */
  parent?: number | string | null;
  /** All threads whose walk-to-root is this message id. */
  root?: number | string | null;
  /** Opaque cursor from the previous page's `nextCursor`. Never derive from ids. */
  cursor?: string | null;
  limit?: number;
}

export interface FluxyThreadPage {
  threads: FluxyRoomThread[];
  hasMore: boolean;
  nextCursor: string | null;
}

/** Direct replies to `threadParentId` only. Nested replies belong to their own lens. */
export function messagesInReplyThread<T extends { parentId?: number | null }>(
  messages: readonly T[],
  threadParentId: number,
): T[] {
  return messages.filter((m) => m.parentId === threadParentId);
}

export function encodeRoomThreadCursor(lastReplyAt: string, threadId: number): string {
  const json = JSON.stringify({ t: lastReplyAt, id: threadId });
  if (typeof btoa === "function") return btoa(json);
  return Buffer.from(json, "utf8").toString("base64");
}

export function decodeRoomThreadCursor(
  raw: string,
): { t: string; id: number } | null {
  try {
    const json =
      typeof atob === "function"
        ? atob(raw)
        : Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(json) as { t?: unknown; id?: unknown };
    if (typeof parsed.t !== "string" || typeof parsed.id !== "number" || !Number.isFinite(parsed.id)) {
      return null;
    }
    return { t: parsed.t, id: parsed.id };
  } catch {
    return null;
  }
}
