"use client";

import React from "react";
import type { FluxyBoundRoom } from "./fluxy-room";
import type { FluxyRoomLiveMember } from "./fluxy-chat-client";
import { useBoundRoom } from "./use-bound-room";

/** Ably `usePresenceListener`: roster from get() refreshed on presence events. */
export function usePresenceListener(room?: FluxyBoundRoom) {
  const bound = useBoundRoom(room);
  const [presenceData, setPresenceData] = React.useState<FluxyRoomLiveMember[]>([]);
  const [error, setError] = React.useState<string | undefined>();

  React.useEffect(() => {
    let cancelled = false;
    function refresh() {
      bound.presence
        .get()
        .then((rows) => {
          if (cancelled) return;
          setPresenceData(rows);
          setError(undefined);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : String(err));
        });
    }
    refresh();
    const stop = bound.presence.subscribe(() => refresh());
    return () => {
      cancelled = true;
      stop();
    };
  }, [bound]);

  return { presenceData, error };
}
