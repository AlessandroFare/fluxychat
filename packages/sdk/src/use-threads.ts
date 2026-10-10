"use client";

import React from "react";
import type { FluxyChatClient } from "./fluxy-chat-client";
import { useFluxyChatOptional } from "./use-fluxy-chat";
import {
  appendCommentToThreads,
  mergeCommentThread,
  removeCommentFromThreads,
  removeThreadById,
  replaceCommentInThreads,
  searchCommentThreads,
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
  markThreadAsUnresolved: (threadId: string) => Promise<void>;
  deleteThread: (threadId: string) => Promise<void>;
  deleteComment: (threadId: string, commentId: string) => Promise<void>;
  editComment: (threadId: string, commentId: string, body: string) => Promise<void>;
  editThreadMetadata: (threadId: string, metadata: FluxyCommentThreadMetadata) => Promise<void>;
  addReaction: (threadId: string, commentId: string, emoji: string) => Promise<void>;
  removeReaction: (threadId: string, commentId: string, emoji: string) => Promise<void>;
  searchThreads: (query: string) => FluxyCommentThread[];
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

  const markThreadAsUnresolved = React.useCallback(
    async (threadId: string) => markThreadAsResolved(threadId, false),
    [markThreadAsResolved],
  );

  const deleteThread = React.useCallback(
    async (threadId: string) => {
      if (!client) return;
      await client.deleteCommentThread(roomId, threadId);
      setThreads((prev) => removeThreadById(prev, threadId));
    },
    [client, roomId],
  );

  const editComment = React.useCallback(
    async (threadId: string, commentId: string, body: string) => {
      if (!client) return;
      const comment = await client.editComment(roomId, threadId, commentId, body);
      if (comment) setThreads((prev) => replaceCommentInThreads(prev, comment));
    },
    [client, roomId],
  );

  const deleteComment = React.useCallback(
    async (threadId: string, commentId: string) => {
      if (!client) return;
      await client.deleteComment(roomId, threadId, commentId);
      setThreads((prev) => removeCommentFromThreads(prev, threadId, commentId));
    },
    [client, roomId],
  );

  const editThreadMetadata = React.useCallback(
    async (threadId: string, metadata: FluxyCommentThreadMetadata) => {
      if (!client) return;
      await client.editThreadMetadata(roomId, threadId, metadata);
      setThreads((prev) =>
        prev.map((thread) => (thread.id === threadId ? { ...thread, metadata } : thread)),
      );
    },
    [client, roomId],
  );

  const searchThreads = React.useCallback(
    (query: string) => searchCommentThreads(threads, query),
    [threads],
  );

  const addReaction = React.useCallback(
    async (threadId: string, commentId: string, emoji: string) => {
      if (!client) return;
      const comment = await client.addCommentReaction(roomId, threadId, commentId, emoji);
      if (comment) setThreads((prev) => replaceCommentInThreads(prev, comment));
    },
    [client, roomId],
  );

  const removeReaction = React.useCallback(
    async (threadId: string, commentId: string, emoji: string) => {
      if (!client) return;
      const comment = await client.removeCommentReaction(roomId, threadId, commentId, emoji);
      if (comment) setThreads((prev) => replaceCommentInThreads(prev, comment));
    },
    [client, roomId],
  );

  return {
    threads,
    loading,
    error,
    reload,
    createThread,
    createComment,
    markThreadAsResolved,
    markThreadAsUnresolved,
    deleteThread,
    deleteComment,
    editComment,
    editThreadMetadata,
    addReaction,
    removeReaction,
    searchThreads,
  };
}
