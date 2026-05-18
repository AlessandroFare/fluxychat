"use client";

import React from "react";
import type { FluxyChatClient, FluxyChatRoom } from "./index";

export function useRooms(client: FluxyChatClient) {
  const [rooms, setRooms] = React.useState<(FluxyChatRoom & { unreadCount?: number })[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await client.listRooms();
      setRooms(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    void load();
  }, [client]);

  return { rooms, loading, error, reload: load };
}
