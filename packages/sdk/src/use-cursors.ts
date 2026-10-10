"use client";

import React from "react";
import type { FluxyBoundRoom } from "./fluxy-room";
import {
  parseLiveCursorEvent,
  type LiveCursor,
  type LiveCursorPublishInput,
} from "./live-cursors";
import { useBoundRoom } from "./use-bound-room";

/** Ably spaces `useCursors` on FluxyRoomProvider. */
export function useCursors(room?: FluxyBoundRoom) {
  const bound = useBoundRoom(room);
  const [byUser, setByUser] = React.useState<Record<string, LiveCursor>>({});

  React.useEffect(() => {
    return bound.connection.onAnyEvent((event) => {
      const cursor = parseLiveCursorEvent(event);
      if (!cursor) return;
      setByUser((prev) => ({ ...prev, [cursor.userId]: cursor }));
    });
  }, [bound]);

  const publish = React.useCallback(
    (input: LiveCursorPublishInput) => {
      bound.connection.sendCursor(input);
    },
    [bound],
  );

  return { cursors: Object.values(byUser), publish };
}
