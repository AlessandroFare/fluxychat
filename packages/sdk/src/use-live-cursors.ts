"use client";

import React from "react";
import type { FluxyChatClient } from "./fluxy-chat-client";
import { useChat } from "./use-chat";
import { useFluxyRoomStore } from "./use-fluxy-room-store";
import type { LiveCursor, LiveCursorPublishInput } from "./live-cursors";

export interface UseLiveCursorsOptions {
  roomId: string;
  client?: FluxyChatClient;
  /** Drop peers idle longer than this (default 8s). */
  staleAfterMs?: number;
  selfUserId?: string;
  /**
   * Share the `useChat` WebSocket by passing the same scope.
   * Default `live-cursors` — a second `useChat` without this value opens another socket.
   */
  sessionScope?: string;
}

export interface UseLiveCursorsResult {
  cursors: LiveCursor[];
  publish: (input: LiveCursorPublishInput) => void;
  connected: boolean;
}

export function useLiveCursors({
  roomId,
  client: clientProp,
  staleAfterMs = 8_000,
  selfUserId,
  sessionScope = "live-cursors",
}: UseLiveCursorsOptions): UseLiveCursorsResult {
  const chat = useChat({
    roomId,
    client: clientProp,
    replay: "request",
    crdtMessageList: false,
    sessionScope,
  });
  const liveCursors = useFluxyRoomStore(chat.store, (s) => s.liveCursors);
  const sendCursor = useFluxyRoomStore(chat.store, (s) => s.sendCursor);
  const connected = chat.connected;

  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const cursors = React.useMemo(() => {
    const cutoff = now - staleAfterMs;
    return Object.values(liveCursors).filter((c) => {
      if (selfUserId && c.userId === selfUserId) return false;
      return c.ts >= cutoff;
    });
  }, [liveCursors, selfUserId, staleAfterMs, now]);

  const publish = React.useCallback(
    (input: LiveCursorPublishInput) => {
      sendCursor(input);
    },
    [sendCursor],
  );

  return { cursors, publish, connected };
}
