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

    let closed = false;
    let attempts = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let ws: WebSocket | null = null;

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

    // #27: reconnect with capped exponential backoff + jitter; previously any
    // blip left the hook permanently disconnected.
    const connect = () => {
      if (closed) return;
      ws = client.connectUser(userId);
      ws.addEventListener("open", () => {
        if (closed) return;
        attempts = 0;
        setConnected(true);
      });
      ws.addEventListener("message", onMessage);
      ws.addEventListener("close", () => {
        setConnected(false);
        if (closed) return;
        const backoff = Math.min(30_000, 1_000 * 2 ** attempts++);
        retryTimer = setTimeout(connect, backoff + Math.random() * 1_000);
      });
    };
    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (ws) {
        ws.removeEventListener("message", onMessage);
        ws.close();
      }
      setConnected(false);
    };
  }, [client, userId, enabled]);

  return { connected, socketId, connectionCount, lastEvent };
}
