"use client";

import React from "react";
import type { FluxyBoundRoom, FluxyRoomStatusChange } from "./fluxy-room";
import type { FluxyRoomAttachStatus } from "./room-status";
import { useBoundRoom } from "./use-bound-room";

/** Ably internal `useRoomStatus`: attach status + retryIn on change. */
export function useRoomStatus(room?: FluxyBoundRoom) {
  const bound = useBoundRoom(room);
  const [current, setCurrent] = React.useState<FluxyRoomAttachStatus>(() =>
    bound.status.current(),
  );
  const [change, setChange] = React.useState<FluxyRoomStatusChange | null>(null);

  React.useEffect(() => {
    setCurrent(bound.status.current());
    return bound.status.subscribe((next) => {
      setCurrent(next.current);
      setChange(next);
    });
  }, [bound]);

  return { current, change };
}

/** Liveblocks `useStatus`. */
export const useStatus = useRoomStatus;
