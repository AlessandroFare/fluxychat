"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FluxyChatClient, type FluxyChatEvent } from "@fluxy-chat/sdk";
import { Section, Input, Button } from "./ui";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { cn } from "@/lib/utils";

const WORKER_URL = getPublicWorkerUrl();
const MAX_EVENTS = 120;

interface InspectorEntry {
  at: string;
  event: FluxyChatEvent;
}

interface RoomLiveStats {
  roomId: string;
  shardCount?: number;
  occupied: boolean;
  subscriptionCount: number;
  userCount: number;
  online: number;
  users: string[];
  socketIds?: string[];
}

export interface RealtimeEventInspectorProps {
  adminJwt?: string;
  defaultRoomId?: string;
  defaultUserId?: string;
}

export function RealtimeEventInspector({
  adminJwt = "",
  defaultRoomId = "",
  defaultUserId = "",
}: RealtimeEventInspectorProps) {
  const [roomId, setRoomId] = useState(defaultRoomId);
  const [userId, setUserId] = useState(defaultUserId);
  const [filterType, setFilterType] = useState("");
  const [entries, setEntries] = useState<InspectorEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [live, setLive] = useState<RoomLiveStats | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [triggerName, setTriggerName] = useState("debug-event");
  const [triggerData, setTriggerData] = useState('{"hello":"world"}');
  const [triggerStatus, setTriggerStatus] = useState<string | null>(null);
  const [terminating, setTerminating] = useState<string | null>(null);

  const client = useMemo(() => {
    if (!adminJwt.trim() || !userId.trim()) return null;
    return new FluxyChatClient({
      baseUrl: WORKER_URL,
      userId: userId.trim(),
      token: adminJwt.trim(),
    });
  }, [adminJwt, userId]);

  const refreshLive = useCallback(async () => {
    if (!client || !roomId.trim()) return;
    setLiveError(null);
    try {
      const stats = await client.getRoomLive(roomId.trim());
      setLive(stats as RoomLiveStats);
    } catch (err: unknown) {
      setLiveError(err instanceof Error ? err.message : "Failed to load live stats");
    }
  }, [client, roomId]);

  useEffect(() => {
    void refreshLive();
    const t = setInterval(() => void refreshLive(), 5000);
    return () => clearInterval(t);
  }, [refreshLive]);

  useEffect(() => {
    const trimmedRoom = roomId.trim();
    const trimmedUser = userId.trim();
    if (!adminJwt || !trimmedRoom || !trimmedUser) {
      setConnected(false);
      return;
    }

    const wsClient = new FluxyChatClient({
      baseUrl: WORKER_URL,
      userId: trimmedUser,
      token: adminJwt,
    });
    const connection = wsClient.connectRoom(trimmedRoom, {
      wsReplay: "off",
      maxReconnectAttempts: 3,
      onStatusChange: (status) => setConnected(status === "connected"),
    });

    const onAny = (event: FluxyChatEvent) => {
      setEntries((prev) =>
        [{ at: new Date().toISOString(), event }, ...prev].slice(0, MAX_EVENTS),
      );
    };

    connection.onAnyEvent(onAny);
    connection.connect();

    return () => {
      connection.offAnyEvent(onAny);
      connection.close();
      setConnected(false);
    };
  }, [adminJwt, roomId, userId]);

  const filtered = useMemo(() => {
    const q = filterType.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.event.type.toLowerCase().includes(q));
  }, [entries, filterType]);

  async function handleTrigger() {
    if (!client || !roomId.trim()) return;
    setTriggerStatus(null);
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(triggerData) as Record<string, unknown>;
    } catch {
      setTriggerStatus("Invalid JSON in event data");
      return;
    }
    try {
      await client.triggerEvents({
        roomIds: [roomId.trim()],
        name: triggerName.trim() || "debug-event",
        data,
      });
      setTriggerStatus("Triggered on room");
      void refreshLive();
    } catch (err: unknown) {
      setTriggerStatus(err instanceof Error ? err.message : "Trigger failed");
    }
  }

  async function handleTerminateSocket(socketId: string) {
    if (!client || !roomId.trim()) return;
    setTerminating(socketId);
    try {
      await client.terminateRoomConnection(roomId.trim(), socketId);
      setTriggerStatus(`Terminated ${socketId}`);
      await refreshLive();
    } catch (err: unknown) {
      setTriggerStatus(err instanceof Error ? err.message : "Terminate failed");
    } finally {
      setTerminating(null);
    }
  }

  return (
    <Section
      title="Live event inspector (v2)"
      description="Pusher-style debug console: live channel stats, socket list, HTTP trigger, and WebSocket event stream."
    >
      {!adminJwt ? (
        <p className="text-sm text-muted-foreground">Admin JWT required to attach inspector.</p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-3">
        <Input
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          placeholder="Room id"
        />
        <Input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="JWT sub / user id"
        />
        <Input
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          placeholder="Filter by type (e.g. message)"
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold text-foreground">Channel live</span>
            <Button type="button" variant="outline" className="h-7 px-2 text-xs" onClick={() => void refreshLive()}>
              Refresh
            </Button>
          </div>
          {liveError ? <p className="text-amber-600">{liveError}</p> : null}
          {live ? (
            <ul className="space-y-1 text-muted-foreground">
              <li>
                Occupied: <span className="text-foreground">{live.occupied ? "yes" : "no"}</span> · online{" "}
                {live.online} · users {live.userCount}
                {live.shardCount && live.shardCount > 1 ? ` · shards ${live.shardCount}` : null}
              </li>
              <li>Users: {live.users.length ? live.users.join(", ") : "—"}</li>
            </ul>
          ) : (
            <p className="text-muted-foreground">No stats yet.</p>
          )}
          <div className="mt-2 max-h-28 overflow-auto">
            {(live?.socketIds ?? []).length === 0 ? (
              <p className="text-muted-foreground">No sockets.</p>
            ) : (
              (live?.socketIds ?? []).map((sid) => (
                <div key={sid} className="flex items-center gap-2 py-0.5 font-mono">
                  <span className="truncate text-foreground/90">{sid}</span>
                  <Button
                    type="button"
                    variant="outline"
                    className="ml-auto h-6 shrink-0 px-1.5 text-[10px]"
                    disabled={terminating === sid}
                    onClick={() => void handleTerminateSocket(sid)}
                  >
                    Kill
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs">
          <p className="mb-2 font-semibold text-foreground">Trigger event (HTTP)</p>
          <Input
            className="mb-2"
            value={triggerName}
            onChange={(e) => setTriggerName(e.target.value)}
            placeholder="Event name"
          />
          <textarea
            className="mb-2 w-full rounded border border-border/60 bg-background px-2 py-1 font-mono text-[11px]"
            rows={3}
            value={triggerData}
            onChange={(e) => setTriggerData(e.target.value)}
          />
          <Button type="button" variant="outline" className="h-7 px-2 text-xs" onClick={() => void handleTrigger()}>
            Send trigger
          </Button>
          {triggerStatus ? <p className="mt-2 text-muted-foreground">{triggerStatus}</p> : null}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        <span
          className={cn(
            "inline-flex h-2 w-2 rounded-full",
            connected ? "bg-emerald-500" : "bg-muted-foreground/40",
          )}
        />
        {connected ? "Connected" : "Disconnected"} · {filtered.length} event(s)
        <Button
          type="button"
          variant="outline"
          className="ml-auto h-7 px-2 text-xs"
          onClick={() => setEntries([])}
        >
          Clear
        </Button>
      </div>
      <div className="mt-3 max-h-80 overflow-auto rounded-md border border-border/60 bg-muted/20 p-2 font-mono text-[11px]">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground">No events yet.</p>
        ) : (
          filtered.map((entry, idx) => (
            <div key={`${entry.at}-${idx}`} className="border-b border-border/40 py-1.5 last:border-0">
              <div className="text-muted-foreground">{entry.at}</div>
              <div className="text-brand">{entry.event.type}</div>
              <pre className="whitespace-pre-wrap break-all text-foreground/90">
                {JSON.stringify(entry.event, null, 0)}
              </pre>
            </div>
          ))
        )}
      </div>
    </Section>
  );
}
