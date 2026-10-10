export interface FluxyCommentThreadMetadata {
  x?: number;
  y?: number;
  sceneId?: string;
  quote?: string;
}

export interface FluxyComment {
  id: string;
  threadId: string;
  userId: string;
  body: string;
  createdAt: string;
  editedAt?: string | null;
  reactions?: Record<string, string[]>;
}

export interface FluxyCommentThread {
  id: string;
  roomId: string;
  createdBy: string;
  metadata: FluxyCommentThreadMetadata;
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
  comments: FluxyComment[];
}

export function mergeCommentThread(
  threads: FluxyCommentThread[],
  incoming: FluxyCommentThread,
): FluxyCommentThread[] {
  const idx = threads.findIndex((t) => t.id === incoming.id);
  if (idx < 0) return [...threads, incoming];
  const next = [...threads];
  next[idx] = incoming;
  return next;
}

export function appendCommentToThreads(
  threads: FluxyCommentThread[],
  comment: FluxyComment,
): FluxyCommentThread[] {
  return threads.map((thread) => {
    if (thread.id !== comment.threadId) return thread;
    if (thread.comments.some((c) => c.id === comment.id)) return thread;
    return { ...thread, comments: [...thread.comments, comment] };
  });
}

export function replaceCommentInThreads(
  threads: FluxyCommentThread[],
  comment: FluxyComment,
): FluxyCommentThread[] {
  return threads.map((thread) => {
    if (thread.id !== comment.threadId) return thread;
    return {
      ...thread,
      comments: thread.comments.map((row) => (row.id === comment.id ? { ...row, ...comment } : row)),
    };
  });
}

export function removeThreadById(threads: FluxyCommentThread[], threadId: string): FluxyCommentThread[] {
  return threads.filter((thread) => thread.id !== threadId);
}

export function removeCommentFromThreads(
  threads: FluxyCommentThread[],
  threadId: string,
  commentId: string,
): FluxyCommentThread[] {
  return threads.map((thread) => {
    if (thread.id !== threadId) return thread;
    return { ...thread, comments: thread.comments.filter((row) => row.id !== commentId) };
  });
}

export function searchCommentThreads(
  threads: FluxyCommentThread[],
  query: string,
): FluxyCommentThread[] {
  const q = query.trim().toLowerCase();
  if (!q) return threads;
  return threads.filter(
    (thread) =>
      thread.comments.some((row) => row.body.toLowerCase().includes(q)) ||
      String(thread.metadata.quote || "").toLowerCase().includes(q),
  );
}

/** tldraw `SidebarFilters` / comments-filter-menu HOW. */
export type CommentThreadFilter = "all" | "open" | "resolved";

export function filterCommentThreads(
  threads: FluxyCommentThread[],
  filter: CommentThreadFilter = "all",
): FluxyCommentThread[] {
  if (filter === "open") return threads.filter((thread) => !thread.resolved);
  if (filter === "resolved") return threads.filter((thread) => thread.resolved);
  return threads;
}

export function commentThreadPreview(thread: FluxyCommentThread): string {
  const body = thread.comments[0]?.body?.trim();
  if (body) return body;
  return thread.metadata.quote?.trim() || "Comment";
}
