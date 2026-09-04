"use client";

import React from "react";
import { messagesInReplyThread } from "./chat-threads";
import { useChat, type UseChatOptions } from "./use-chat";
import { useFluxyChatOptional } from "./use-fluxy-chat";
import type { FluxyChatAttachment, FluxyChatMessage } from "./fluxy-chat-client";
import type { FluxySendMessageOptions } from "./message-template";

export interface UseThreadOptions extends UseChatOptions {
  /** Parent message id (= thread id). Direct replies only. */
  threadParentId: number;
}

export function useThread(options: UseThreadOptions) {
  const { threadParentId, client: clientProp, ...chatOptions } = options;
  const chat = useChat({ ...chatOptions, client: clientProp });
  const realtime = useFluxyChatOptional();
  const client = clientProp === undefined ? (realtime?.client ?? null) : clientProp;

  const [older, setOlder] = React.useState<FluxyChatMessage[]>([]);
  const [isLoadingPrevious, setIsLoadingPrevious] = React.useState(false);
  const [hasPrevious, setHasPrevious] = React.useState(true);

  React.useEffect(() => {
    setOlder([]);
    setHasPrevious(true);
  }, [options.roomId, threadParentId]);

  const live = React.useMemo(
    () => messagesInReplyThread(chat.messages, threadParentId),
    [chat.messages, threadParentId],
  );

  const messages = React.useMemo(() => {
    const byId = new Map<number, FluxyChatMessage>();
    for (const row of older) byId.set(row.id, row);
    for (const row of live) byId.set(row.id, row);
    return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [older, live]);

  const sendMessage = React.useCallback(
    (
      content: string,
      replyTo?: number | null,
      attachments?: FluxyChatAttachment[],
      sendOptions?: FluxySendMessageOptions,
      existingClientMessageId?: string,
    ) =>
      chat.sendMessage(
        content,
        replyTo ?? threadParentId,
        attachments,
        sendOptions,
        existingClientMessageId,
      ),
    [chat.sendMessage, threadParentId],
  );

  const loadPrevious = React.useCallback(async (): Promise<boolean> => {
    if (!client?.fetchMessages || isLoadingPrevious) return false;
    setIsLoadingPrevious(true);
    try {
      const oldest = messages[0];
      const page = await client.fetchMessages(options.roomId, {
        limit: 50,
        parentId: threadParentId,
        ...(oldest?.createdAt ? { before: oldest.createdAt } : {}),
      });
      if (page.length === 0) {
        setHasPrevious(false);
        return false;
      }
      setOlder((prev) => {
        const byId = new Map(prev.map((m) => [m.id, m]));
        for (const row of page) byId.set(row.id, row);
        return [...byId.values()];
      });
      if (page.length < 50) setHasPrevious(false);
      return true;
    } finally {
      setIsLoadingPrevious(false);
    }
  }, [
    client,
    isLoadingPrevious,
    messages,
    options.roomId,
    threadParentId,
  ]);

  return {
    ...chat,
    threadParentId,
    messages,
    sendMessage,
    loadPrevious,
    hasPrevious,
    isLoadingPrevious,
  };
}
