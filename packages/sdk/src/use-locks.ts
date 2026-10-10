"use client";

import React from "react";
import type { FluxyBoundRoom } from "./fluxy-room";
import type { FluxyLockEvent } from "./room-locks";
import { useBoundRoom } from "./use-bound-room";

/** Ably spaces `useLocks`: acquire/release + latest lock frame. */
export function useLocks(room?: FluxyBoundRoom) {
  const bound = useBoundRoom(room);
  const [latest, setLatest] = React.useState<FluxyLockEvent | null>(null);

  React.useEffect(() => bound.locks.subscribe((event) => setLatest(event)), [bound]);

  return {
    acquire: bound.locks.acquire,
    release: bound.locks.release,
    get: bound.locks.get,
    getSelf: bound.locks.getSelf,
    getOthers: bound.locks.getOthers,
    latest,
  };
}
