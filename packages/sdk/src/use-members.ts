"use client";

import React from "react";
import type { FluxyBoundRoom } from "./fluxy-room";
import type { FluxySpaceMember } from "./room-members";
import { useBoundRoom } from "./use-bound-room";

/** Ably spaces `useMembers`: roster including leavers until offlineTimeout. */
export function useMembers(room?: FluxyBoundRoom) {
  const bound = useBoundRoom(room);
  const [members, setMembers] = React.useState<FluxySpaceMember[]>([]);
  const [error, setError] = React.useState<string | undefined>();

  React.useEffect(() => {
    let cancelled = false;
    function refresh() {
      bound.members
        .getAll()
        .then((rows) => {
          if (cancelled) return;
          setMembers(rows);
          setError(undefined);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : String(err));
        });
    }
    refresh();
    const stop = bound.members.subscribe("update", () => refresh());
    return () => {
      cancelled = true;
      stop();
    };
  }, [bound]);

  return { members, error };
}
