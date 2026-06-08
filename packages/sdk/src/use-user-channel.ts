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

export function useUserChannel({
  client,
  userId,
  enabled = true,
  onEvent,
}: UseUserChannelOptions): UseUserChannelState {
  const [connected, setConnected] = React.useState(false);
  const [socketId, setSocketId] = React.useState<string | null>(null);
  const [connectionCount, setConnectionCount] = React.useState(0);
  const [lastEvent, setLastEvent] = React.useState<FluxyChatEvent | null>(null);
  const onEventRef = React.useRef(onEvent);
  onEventRef.current = onEvent;

  React.useEffect(() => {
    if (!enabled || !client?.isAuthenticated()) {
      setConnected(false);
      return;
    }

    const ws = client.connectUser(userId);
    const onMessage = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(String(ev.data)) as FluxyChatEvent;
        if (data.type === "user_subscription_succeeded") {
          setSocketId(data.socketId ?? null);
          setConnectionCount(data.connectionCount);
          return;
        }
        setLastEvent(data);
        onEventRef.current?.(data);
      } catch {
        /* ignore */
      }
    };

    ws.addEventListener("open", () => setConnected(true));
    ws.addEventListener("close", () => setConnected(false));
    ws.addEventListener("message", onMessage);

    return () => {
      ws.removeEventListener("message", onMessage);
      ws.close();
      setConnected(false);
    };
  }, [client, userId, enabled]);

  return { connected, socketId, connectionCount, lastEvent };
}
