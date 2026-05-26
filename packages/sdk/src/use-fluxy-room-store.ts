"use client";

import { useStore } from "zustand";
import type { FluxyRoomStore, FluxyRoomStoreState } from "./fluxy-room-store";

/** Subscribe to a Fluxy room store from React (works with Vue via `store.subscribe`). */
export function useFluxyRoomStore<T>(
  store: FluxyRoomStore,
  selector: (state: FluxyRoomStoreState) => T,
): T {
  return useStore(store, selector);
}

/** Full room store snapshot + actions. */
export function useFluxyRoomStoreState(store: FluxyRoomStore): FluxyRoomStoreState {
  return useStore(store);
}
