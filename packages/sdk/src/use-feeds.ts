"use client";

import React from "react";
import type { FluxyChatClient } from "./fluxy-chat-client";
import { useFluxyChatOptional } from "./use-fluxy-chat";
import {
  appendFeedMessage,
  mergeFeed,
  type FluxyFeed,
  type FluxyFeedMessage,
  type FluxyFeedMessageMetadata,
} from "./room-feeds";

export interface UseFeedsOptions {
  roomId: string;
  client?: FluxyChatClient | null;
}

export interface UseFeedsResult {
  feeds: FluxyFeed[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  createFeed: (input: { name: string; kind?: string }) => Promise<FluxyFeed | null>;
}

export function useFeeds({ roomId, client: clientProp }: UseFeedsOptions): UseFeedsResult {
  const realtime = useFluxyChatOptional();
  const client = clientProp === undefined ? (realtime?.client ?? null) : clientProp;
  const [feeds, setFeeds] = React.useState<FluxyFeed[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    if (!client || !roomId) {
      setFeeds([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setFeeds(await client.listFeeds(roomId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "feeds_load_failed");
    } finally {
      setLoading(false);
    }
  }, [client, roomId]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const createFeed = React.useCallback(
    async (input: { name: string; kind?: string }) => {
      if (!client) return null;
      const feed = await client.createFeed(roomId, input);
      if (feed) setFeeds((prev) => mergeFeed(prev, feed));
      return feed;
    },
    [client, roomId],
  );

  return { feeds, loading, error, reload, createFeed };
}

export function useCreateFeed(options: UseFeedsOptions) {
  return useFeeds(options).createFeed;
}

export interface UseFeedMessagesOptions {
  roomId: string;
  feedId: string | null;
  client?: FluxyChatClient | null;
}

export interface UseFeedMessagesResult {
  messages: FluxyFeedMessage[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  createMessage: (input: { body: string; metadata?: FluxyFeedMessageMetadata }) => Promise<FluxyFeedMessage | null>;
}

export function useFeedMessages({
  roomId,
  feedId,
  client: clientProp,
}: UseFeedMessagesOptions): UseFeedMessagesResult {
  const realtime = useFluxyChatOptional();
  const client = clientProp === undefined ? (realtime?.client ?? null) : clientProp;
  const [messages, setMessages] = React.useState<FluxyFeedMessage[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    if (!client || !roomId || !feedId) {
      setMessages([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setMessages(await client.listFeedMessages(roomId, feedId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "feed_messages_load_failed");
    } finally {
      setLoading(false);
    }
  }, [client, feedId, roomId]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const createMessage = React.useCallback(
    async (input: { body: string; metadata?: FluxyFeedMessageMetadata }) => {
      if (!client || !feedId) return null;
      const message = await client.createFeedMessage(roomId, feedId, input);
      if (message) setMessages((prev) => appendFeedMessage(prev, message));
      return message;
    },
    [client, feedId, roomId],
  );

  return { messages, loading, error, reload, createMessage };
}

export function useCreateFeedMessage(options: UseFeedMessagesOptions) {
  return useFeedMessages(options).createMessage;
}
