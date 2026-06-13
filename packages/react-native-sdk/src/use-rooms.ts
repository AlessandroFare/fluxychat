"use client";

import React from "react";
import type { FluxyChatClient, FluxyChatRoom } from "./index";

export function useRooms(client: FluxyChatClient | null) {
  const [rooms, setRooms] = React.useState<(FluxyChatRoom & { unreadCount?: number })[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setError(null);
    try { setRooms(await client.listRooms()); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [client]);

  React.useEffect(() => { void load(); }, [load]);
  return { rooms, loading, error, reload: load };
}
