"use client";

import React from "react";
import type { FluxyRoomStore } from "./fluxy-room-store";
import { INERT_FLUXY_ROOM_SNAPSHOT } from "./fluxy-room-store";
import { useFluxyRoomStore } from "./use-fluxy-room-store";
import type { FluxyOccupancyData } from "./occupancy";
import type { FluxyBoundRoom } from "./fluxy-room";
import { FluxyRoomContext } from "./use-bound-room";

const INERT_OCCUPANCY_STORE: FluxyRoomStore = {
  getState: () => INERT_FLUXY_ROOM_SNAPSHOT,
  getInitialState: () => INERT_FLUXY_ROOM_SNAPSHOT,
  setState: () => {},
  subscribe: () => () => {},
};

function isRoomStore(value: unknown): value is FluxyRoomStore {
  return Boolean(value && typeof value === "object" && "getState" in value && "subscribe" in value);
}

function occupancyFromRoom(room: FluxyBoundRoom | null): FluxyOccupancyData {
  return room?.occupancy.current() ?? { connections: 0, presenceMembers: 0, watching: 0 };
}

/** Ably `useOccupancy`: store snapshot, or live counts from FluxyRoomProvider. */
export function useOccupancy(store: FluxyRoomStore): FluxyOccupancyData;
export function useOccupancy(room?: FluxyBoundRoom): FluxyOccupancyData;
export function useOccupancy(source?: FluxyRoomStore | FluxyBoundRoom): FluxyOccupancyData {
  const ctx = React.useContext(FluxyRoomContext);
  const usingStore = isRoomStore(source);
  const store = usingStore ? source : INERT_OCCUPANCY_STORE;
  const bound = usingStore ? null : (source ?? ctx);
  const storeConnections = useFluxyRoomStore(store, (s) => s.subscriptionCount);
  const storeMembers = useFluxyRoomStore(store, (s) => s.presenceCount);
  const [live, setLive] = React.useState<FluxyOccupancyData>(() => occupancyFromRoom(bound));

  React.useEffect(() => {
    if (!bound?.occupancy) return;
    setLive(occupancyFromRoom(bound));
    return bound.occupancy.subscribe((event) => setLive(event.occupancy));
  }, [bound]);

  if (usingStore) {
    return {
      connections: storeConnections,
      presenceMembers: storeMembers,
      watching: Math.max(0, storeConnections - storeMembers),
    };
  }
  if (!bound?.occupancy) {
    throw new Error("useOccupancy needs a room store, a bound room, or FluxyRoomProvider");
  }
  return live;
}
