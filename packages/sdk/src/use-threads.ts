"use client";

import React from "react";
import type { FluxyChatClient } from "./fluxy-chat-client";
import { useFluxyChatOptional } from "./use-fluxy-chat";
import {
  appendCommentToThreads,
  mergeCommentThread,
  type FluxyCommentThread,
  type FluxyCommentThreadMetadata,
} from "./comment-threads";

export interface UseThreadsOptions {
  roomId: string;
  client?: FluxyChatClient | null;
}

export interface UseThreadsResult {
  threads: FluxyCommentThread[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  createThread: (input: { body: string; metadata?: FluxyCommentThreadMetadata }) => Promise<FluxyCommentThread | null>;
  createComment: (threadId: string, body: string) => Promise<void>;
  markThreadAsResolved: (threadId: string, resolved?: boolean) => Promise<void>;
}

export function useThreads({ roomId, client: clientProp }: UseThreadsOptions): UseThreadsResult {
  const realtime = useFluxyChatOptional();
  const client = clientProp === undefined ? (realtime?.client ?? null) : clientProp;
  const [threads, setThreads] = React.useState<FluxyCommentThread[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    if (!client || !roomId || !client.token) {
      setThreads([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await client.listCommentThreads(roomId);
      setThreads(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "threads_load_failed");
    } finally {
      setLoading(false);
    }
  }, [client, roomId]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const createThread = React.useCallback(
    async (input: { body: string; metadata?: FluxyCommentThreadMetadata }) => {
      if (!client) return null;
      const thread = await client.createCommentThread(roomId, input);
      if (thread) setThreads((prev) => mergeCommentThread(prev, thread));
      return thread;
    },
    [client, roomId],
  );

  const createComment = React.useCallback(
    async (threadId: string, body: string) => {
      if (!client) return;
      const comment = await client.createComment(roomId, threadId, body);
      if (comment) setThreads((prev) => appendCommentToThreads(prev, comment));
    },
    [client, roomId],
  );

  const markThreadAsResolved = React.useCallback(
    async (threadId: string, resolved = true) => {
      if (!client) return;
      await client.markThreadAsResolved(roomId, threadId, resolved);
      setThreads((prev) =>
        prev.map((thread) => (thread.id === threadId ? { ...thread, resolved } : thread)),
      );
    },
    [client, roomId],
  );

  return { threads, loading, error, reload, createThread, createComment, markThreadAsResolved };
}
