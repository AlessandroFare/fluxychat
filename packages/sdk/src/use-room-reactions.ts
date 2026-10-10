"use client";

import React from "react";
import type { FluxyBoundRoom } from "./fluxy-room";
import type { FluxyRoomReactionEvent } from "./room-reactions";
import { useBoundRoom } from "./use-bound-room";

/** Ably `useRoomReactions`: send ephemeral room reactions; latest inbound event. */
export function useRoomReactions(room?: FluxyBoundRoom) {
  const bound = useBoundRoom(room);
  const [latest, setLatest] = React.useState<FluxyRoomReactionEvent | null>(null);

  React.useEffect(() => {
    return bound.reactions.subscribe((event) => {
      setLatest(event);
    });
  }, [bound]);

  const send = React.useCallback(
    (name: string) => {
      bound.reactions.send(name);
    },
    [bound],
  );

  return { send, latest };
}
