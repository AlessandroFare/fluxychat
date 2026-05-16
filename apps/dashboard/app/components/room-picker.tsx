"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { FluxyChatClient, type FluxyChatRoom } from "@fluxychat/sdk";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { messageFromUnknown } from "@/lib/error-message";
import { cn } from "@/lib/utils";
import { Input } from "./ui";

interface RoomPickerProps {
  value: string;
  onChange: (roomId: string) => void;
  /** Admin or member JWT for GET /rooms */
  token: string;
  /** Show an empty option (e.g. search across all rooms). */
  allowEmpty?: boolean;
  emptyLabel?: string;
  placeholder?: string;
  className?: string;
  onRoomsLoaded?: (rooms: FluxyChatRoom[]) => void;
}

export function RoomPicker({
  value,
  onChange,
  token,
  allowEmpty = false,
  emptyLabel = "All rooms",
  placeholder = "room-id",
  className,
  onRoomsLoaded,
}: RoomPickerProps) {
  const [rooms, setRooms] = useState<FluxyChatRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"list" | "custom">("list");
  const [loadError, setLoadError] = useState<string | null>(null);

  const client = useMemo(
    () =>
      new FluxyChatClient({
        baseUrl: getPublicWorkerUrl(),
        userId: "console",
        token: token.trim() || undefined,
      }),
    [token],
  );

  const loadRooms = useCallback(async () => {
    if (!token.trim()) {
      setRooms([]);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const list = await client.listRooms();
      setRooms(list);
      onRoomsLoaded?.(list);
    } catch (e: unknown) {
      setLoadError(messageFromUnknown(e, "Failed to load rooms"));
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }, [client, token, onRoomsLoaded]);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  const listSelectValue = useMemo(() => {
    if (allowEmpty) return value;
    if (value.trim() && rooms.some((room) => room.id === value)) return value;
    if (rooms.length > 0) return rooms[0].id;
    return "";
  }, [allowEmpty, rooms, value]);

  useLayoutEffect(() => {
    if (loading || allowEmpty || rooms.length === 0 || mode !== "list") return;
    if (listSelectValue && listSelectValue !== value) {
      onChange(listSelectValue);
    }
  }, [allowEmpty, listSelectValue, loading, mode, onChange, rooms.length, value]);

  if (!token.trim()) {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
      />
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          className={cn(
            "rounded-full px-2.5 py-1 transition-colors",
            mode === "list" ? "bg-primary/10 font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setMode("list")}
        >
          Project rooms
        </button>
        <button
          type="button"
          className={cn(
            "rounded-full px-2.5 py-1 transition-colors",
            mode === "custom" ? "bg-primary/10 font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setMode("custom")}
        >
          Custom ID
        </button>
        <button
          type="button"
          className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          onClick={() => void loadRooms()}
          disabled={loading}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>
      {loadError ? <p className="text-xs text-red-600">{loadError}</p> : null}
      {mode === "list" ? (
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          value={listSelectValue}
          onChange={(e) => onChange(e.target.value)}
        >
          {allowEmpty ? <option value="">{emptyLabel}</option> : null}
          {!loading && rooms.length === 0 ? (
            <option value="">{allowEmpty ? emptyLabel : "No rooms yet — create one in Rooms"}</option>
          ) : null}
          {!loading && rooms.length > 0 && !value && !allowEmpty ? (
            <option value="" disabled>
              Select a room…
            </option>
          ) : null}
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name ? `${r.name} (${r.id})` : r.id}
            </option>
          ))}
        </select>
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
    </div>
  );
}
