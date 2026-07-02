"use client";

import React from "react";
import type { FluxyChatClient, FluxyChatEvent } from "./index";

export interface UseUserChannelOptions {
  client: FluxyChatClient | null;
  userId?: string;
  enabled?: boolean;
  onEvent?: (event: FluxyChatEvent) => void;
}

export interface UseUserChannelState {
  connected: boolean;
  socketId: string | null;
  connectionCount: number;
  lastEvent: FluxyChatEvent | null;
}

export function useUserChannel({ client, userId, enabled = true, onEvent }: UseUserChannelOptions): UseUserChannelState {
  const [connected, setConnected] = React.useState(false);
  const [socketId, setSocketId] = React.useState<string | null>(null);
  const [connectionCount, setConnectionCount] = React.useState(0);
  const [lastEvent, setLastEvent] = React.useState<FluxyChatEvent | null>(null);
  const onEventRef = React.useRef(onEvent);
  onEventRef.current = onEvent;

  React.useEffect(() => {
    if (!enabled || !client?.isAuthenticated()) { setConnected(false); return; }
    client.connectUser(userId);
    const checkInterval = setInterval(() => {
      setConnected(true);
    }, 1000);
    return () => { clearInterval(checkInterval); client.disconnectUser(); };
  }, [client, userId, enabled]);

  return { connected, socketId, connectionCount, lastEvent };
}
