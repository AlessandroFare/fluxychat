"use client";

import React from "react";
import type { FluxyChatClient, FluxyInAppNotification } from "./index";

export function useNotifications(
  client: FluxyChatClient | null,
  options?: { limit?: number; unreadOnly?: boolean; pollMs?: number },
) {
  const [notifications, setNotifications] = React.useState<FluxyInAppNotification[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const limit = options?.limit ?? 50;
  const unreadOnly = options?.unreadOnly ?? false;
  const pollMs = options?.pollMs ?? 0;

  const reload = React.useCallback(async () => {
    if (!client?.isAuthenticated()) {
      setNotifications([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await client.listNotifications({ limit, unreadOnly });
      setNotifications(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [client, limit, unreadOnly]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  React.useEffect(() => {
    if (!pollMs || pollMs < 1000) return;
    const id = window.setInterval(() => void reload(), pollMs);
    return () => window.clearInterval(id);
  }, [pollMs, reload]);

  const markRead = React.useCallback(
    async (id: number) => {
      if (!client) return;
      await client.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, read_at: new Date().toISOString() } : n,
        ),
      );
    },
    [client],
  );

  const markAllRead = React.useCallback(async () => {
    if (!client) return;
    await client.markAllNotificationsRead();
    await reload();
  }, [client, reload]);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return {
    notifications,
    unreadCount,
    loading,
    error,
    reload,
    markRead,
    markAllRead,
  };
}
