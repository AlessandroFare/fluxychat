"use client";

import React from "react";
import type { FluxyChatClient } from "./index";

export interface FluxyRealtimeContextValue {
  client: FluxyChatClient | null;
  userId: string;
  token: string | null;
  workerUrl: string;
  ready: boolean;
  refreshSession: () => void;
  /**
   * Shared by `useChat` / `useLiveCursors` when they omit `sessionScope`
   * (default `app`). Two widgets on the same room must pass different values.
   */
  sessionScope: string;
}

export const FluxyRealtimeContext = React.createContext<FluxyRealtimeContextValue | null>(null);

export function useFluxyChat(): FluxyRealtimeContextValue {
  const ctx = React.useContext(FluxyRealtimeContext);
  if (!ctx) {
    throw new Error("useFluxyChat must be used within FluxyRealtimeProvider");
  }
  return ctx;
}

/** Returns null when no provider is mounted (useChat can still take an explicit client). */
export function useFluxyChatOptional(): FluxyRealtimeContextValue | null {
  return React.useContext(FluxyRealtimeContext);
}
