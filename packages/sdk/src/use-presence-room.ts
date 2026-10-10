"use client";

import React from "react";
import type { FluxyBoundRoom } from "./fluxy-room";
import type { FluxyPresence } from "./presence-patch";
import { useBoundRoom } from "./use-bound-room";

export interface UsePresenceRoomOptions {
  autoEnterLeave?: boolean;
  initialData?: Partial<FluxyPresence>;
}

/** Ably `usePresence`: enter/leave with the bound room. Occupancy leave is still detach. */
export function usePresence(room?: FluxyBoundRoom, options: UsePresenceRoomOptions = {}) {
  const bound = useBoundRoom(room);
  const autoEnterLeave = options.autoEnterLeave !== false;
  const initialRef = React.useRef(options.initialData);

  React.useEffect(() => {
    if (!autoEnterLeave) return;
    bound.presence.enter(initialRef.current);
    return () => {
      void bound.presence.leave();
    };
  }, [bound, autoEnterLeave]);

  return {
    enter: bound.presence.enter,
    update: bound.presence.update,
    leave: bound.presence.leave,
    isUserPresent: bound.presence.isUserPresent,
  };
}
