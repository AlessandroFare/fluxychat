"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { FluxyRoomStore, FluxyRoomStoreState } from "./fluxy-room-store";
import { INERT_FLUXY_ROOM_SNAPSHOT } from "./fluxy-room-store";

function useFluxyRoomSubscribe(store: FluxyRoomStore): (onStoreChange: () => void) => () => void {
  return useCallback((onStoreChange: () => void) => store.subscribe(onStoreChange), [store]);
}

/** Full room store snapshot — Portal-style `useSyncExternalStore` with frozen SSR snapshot. */
export function useFluxyRoomStoreState(store: FluxyRoomStore): FluxyRoomStoreState {
  const subscribe = useFluxyRoomSubscribe(store);
  const getSnapshot = useCallback(() => store.getState(), [store]);
  const getServerSnapshot = useCallback(() => INERT_FLUXY_ROOM_SNAPSHOT, []);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Subscribe to a slice of the room store (client-optimized selector). */
export function useFluxyRoomStore<T>(
  store: FluxyRoomStore,
  selector: (state: FluxyRoomStoreState) => T,
): T {
  const subscribe = useFluxyRoomSubscribe(store);
  const getSnapshot = useCallback(() => selector(store.getState()), [store, selector]);
  const getServerSnapshot = useCallback(() => selector(INERT_FLUXY_ROOM_SNAPSHOT), [selector]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** @deprecated Prefer explicit import — alias for tree-shaking docs. */
export { INERT_FLUXY_ROOM_SNAPSHOT };
