"use client";

import React from "react";
import type { FluxyBoundRoom } from "./fluxy-room";
import type { FluxyRoomMessageEvent } from "./room-messages";
import { useBoundRoom } from "./use-bound-room";

/** Ably `useMessages`: send/update/delete + latest live frame on a bound room. */
export function useMessages(room?: FluxyBoundRoom) {
  const bound = useBoundRoom(room);
  const [latest, setLatest] = React.useState<FluxyRoomMessageEvent | null>(null);

  React.useEffect(() => {
    const sub = bound.messages.subscribe((event) => setLatest(event));
    return () => sub.unsubscribe();
  }, [bound]);

  return {
    sendMessage: bound.messages.send,
    getMessage: bound.messages.get,
    getVersions: bound.messages.getVersions,
    updateMessage: bound.messages.update,
    deleteMessage: bound.messages.delete,
    history: bound.messages.history,
    with: bound.messages.with,
    copy: bound.messages.copy,
    reactions: bound.messages.reactions,
    latest,
  };
}
