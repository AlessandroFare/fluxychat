"use client";

import React from "react";
import type { FluxyBoundRoom } from "./fluxy-room";

export const FluxyRoomContext = React.createContext<FluxyBoundRoom | null>(null);

export function useBoundRoom(room?: FluxyBoundRoom): FluxyBoundRoom {
  const ctx = React.useContext(FluxyRoomContext);
  const resolved = room ?? ctx;
  if (!resolved) {
    throw new Error("This hook needs a room, or a parent FluxyRoomProvider");
  }
  return resolved;
}
