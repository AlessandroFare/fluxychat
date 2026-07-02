"use client";

import React from "react";
import type { FluxyChatClient } from "./index";

export interface NotificationItem {
  id: number;
  kind: string;
  title: string;
  body?: string;
  room_id?: string;
  message_id?: number;
  read_at?: string;
  created_at: string;
}

export function useNotifications(client: FluxyChatClient | null, options?: { limit?: number; pollMs?: number }) {
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const limit = options?.limit ?? 50;
  const pollMs = options?.pollMs ?? 0;

  const reload = React.useCallback(async () => {
    if (!client?.isAuthenticated()) { setNotifications([]); return; }
    setLoading(true); setError(null);
    try { setNotifications((await client.getNotifications(limit)) as NotificationItem[]); }
    catch (e: any) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [client, limit]);

  React.useEffect(() => { void reload(); }, [reload]);
  React.useEffect(() => { if (!pollMs || pollMs < 1000) return; const id = setInterval(() => void reload(), pollMs); return () => clearInterval(id); }, [pollMs, reload]);

  const markRead = React.useCallback(async (id: number) => {
    if (!client) return;
    await client.markNotificationRead(id);
    setNotifications((prev) => prev.map((n: any) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
  }, [client]);

  const markAllRead = React.useCallback(async () => {
    if (!client) return;
    await client.markAllNotificationsRead();
    await reload();
  }, [client, reload]);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return { notifications, unreadCount, loading, error, reload, markRead, markAllRead };
}
