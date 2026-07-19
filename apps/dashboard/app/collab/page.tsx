"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Pen, Plus, ExternalLink, MessageSquare } from "lucide-react";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { useDashboardSession } from "../components/dashboard-session";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { cn } from "@/lib/utils";

const WORKER_URL = getPublicWorkerUrl();

interface Room {
  id: string; name: string; createdAt: string; type: string;
}

export default function CollabPage() {
  const { adminJwt, memberJwt } = useDashboardSession();
  const token = adminJwt.trim() || memberJwt.trim();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  const client = React.useMemo(() => {
    if (!token) return null;
    return new FluxyChatClient({ baseUrl: WORKER_URL, userId: "console", token });
  }, [token]);

  const loadRooms = useCallback(async () => {
    if (!client) return;
    try {
      const res = await client.listRooms?.() ?? { rooms: [] };
      setRooms((res as any).rooms || []);
    } catch { /* noop */ }
    setLoading(false);
  }, [client]);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="FluxyCollab"
        description="Collaborative workspace with whiteboard, notes, kanban & CRDT sync"
      />

      <div className="flex flex-1 flex-col gap-4 p-4 pt-2">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <Link
              key={room.id}
              href={`/collab/${room.id}`}
              className="group rounded-xl border bg-white p-4 shadow-sm transition-all hover:shadow-md dark:bg-gray-900"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
                  <Pen className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">{room.name || `Room #${room.id.slice(0, 8)}`}</h3>
                  <p className="text-xs text-muted-foreground">
                    <MessageSquare className="mr-0.5 inline h-3 w-3" />
                    {room.type || "group"}
                    <span className="ml-2">{new Date(room.createdAt).toLocaleDateString()}</span>
                  </p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </Link>
          ))}
        </div>

        {!loading && rooms.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <Pen className="h-12 w-12 text-muted-foreground" />
            <h2 className="text-lg font-semibold">No collaborative workspaces yet</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Open any room to start collaborating with whiteboard, notes, and kanban.
            </p>
            <Link href="/rooms" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Browse rooms
            </Link>
          </div>
        )}
      </div>
    </ConsoleShell>
  );
}
