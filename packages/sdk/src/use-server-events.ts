import { useEffect, useRef, useState } from "react";
import type { FluxyChatClient } from "./index";

export interface ServerEventLogEntry {
  name: string;
  data: Record<string, unknown>;
  roomId: string;
  userId?: string;
  at: string;
}

export interface UseServerEventsOptions {
  client: FluxyChatClient | null | undefined;
  roomId: string | null | undefined;
  enabled?: boolean;
  /** Keep last N events in memory (default 50). */
  maxEvents?: number;
  filter?: (name: string) => boolean;
}

export interface UseServerEventsResult {
  events: ServerEventLogEntry[];
  lastEvent: ServerEventLogEntry | null;
  connected: boolean;
}

/** Subscribe to Worker `server_event` frames on a room connection (React). */
export function useServerEvents({
  client,
  roomId,
  enabled = true,
  maxEvents = 50,
  filter,
}: UseServerEventsOptions): UseServerEventsResult {
  const [events, setEvents] = useState<ServerEventLogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const filterRef = useRef(filter);
  filterRef.current = filter;

  useEffect(() => {
    if (!client || !roomId || !enabled) {
      setConnected(false);
      return;
    }
    const conn = client.connectRoom(roomId);
    const onStatus = () => {
      setConnected(conn.connectionStatus === "connected");
    };
    conn.connect();
    onStatus();
    const statusTimer = setInterval(onStatus, 500);
    const offServer = conn.onServerEvent((ev) => {
      if (filterRef.current && !filterRef.current(ev.name)) return;
      const entry: ServerEventLogEntry = {
        name: ev.name,
        data: ev.data,
        roomId: ev.roomId,
        userId: ev.userId,
        at: new Date().toISOString(),
      };
      setEvents((prev) => [...prev, entry].slice(-maxEvents));
    });
    return () => {
      clearInterval(statusTimer);
      offServer();
      conn.close();
      setConnected(false);
    };
  }, [client, roomId, enabled, maxEvents]);

  return {
    events,
    lastEvent: events.length > 0 ? events[events.length - 1]! : null,
    connected,
  };
}
