"use client";

import React from "react";
import { useStore } from "zustand";
import type { FluxyRoomStore, FluxyRoomStoreState } from "./room-store";

export function useFluxyRoomStore<T>(store: FluxyRoomStore, selector: (state: FluxyRoomStoreState) => T): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return useStore(store as any, selector);
}

export function useFluxyRoomStoreState(store: FluxyRoomStore): FluxyRoomStoreState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return useStore(store as any) as FluxyRoomStoreState;
}
