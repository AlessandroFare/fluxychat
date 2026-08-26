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
