"use client";

import React from "react";
import type { FluxyBoundRoom } from "./fluxy-room";
import type { FluxyLocationChange } from "./room-locations";
import { useBoundRoom } from "./use-bound-room";

/** Ably spaces `useLocations`: UI locus on the bound room (not GPS `useLocation`). */
export function useLocations(room?: FluxyBoundRoom) {
  const bound = useBoundRoom(room);
  const [latest, setLatest] = React.useState<FluxyLocationChange | null>(null);

  React.useEffect(() => bound.locations.subscribe(setLatest), [bound]);

  return { set: bound.locations.set, latest };
}
