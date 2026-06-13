"use client";

import React from "react";
import { useStore } from "zustand";
import type { FluxyRoomStore, FluxyRoomStoreState } from "./room-store";

export function useFluxyRoomStore<T>(store: FluxyRoomStore, selector: (state: FluxyRoomStoreState) => T): T {
  return useStore(store, selector);
}

export function useFluxyRoomStoreState(store: FluxyRoomStore): FluxyRoomStoreState {
  return useStore(store);
}
