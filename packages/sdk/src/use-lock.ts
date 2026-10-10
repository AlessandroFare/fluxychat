"use client";

import React from "react";
import type { FluxyBoundRoom } from "./fluxy-room";
import type { FluxyLockRecord } from "./room-locks";
import { useBoundRoom } from "./use-bound-room";

/** Ably spaces `useLock`: holder for one lock id. */
export function useLock(lockId: string, room?: FluxyBoundRoom) {
  const bound = useBoundRoom(room);
  const [record, setRecord] = React.useState<FluxyLockRecord | undefined>(() => bound.locks.get(lockId));

  React.useEffect(() => {
    setRecord(bound.locks.get(lockId));
    return bound.locks.subscribe((event) => {
      if (event.lockId && event.lockId !== lockId) return;
      setRecord(bound.locks.get(lockId));
    });
  }, [bound, lockId]);

  return {
    record,
    held: Boolean(record?.held),
    owner: record?.owner ?? null,
    status: record?.status,
    attributes: record?.attributes,
  };
}
