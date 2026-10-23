"use client";

import * as React from "react";
import { Loader2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { messageFromUnknown } from "@/lib/error-message";

export interface ForwardTarget {
  id: string;
  name: string;
  type?: string;
}

export interface ForwardClient {
  listRooms(): Promise<ForwardTarget[]>;
  forwardMessageRest(messageId: number, targetRoomId: string): Promise<unknown>;
}

export function ForwardMessageDialog({
  open,
  client,
  messageId,
  sourceRoomId,
  onClose,
  onForwarded,
}: {
  open: boolean;
  client: ForwardClient | null;
  messageId: number | null;
  sourceRoomId: string;
  onClose: () => void;
  onForwarded?: (targetRoomId: string) => void;
}) {
  const [rooms, setRooms] = React.useState<ForwardTarget[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    if (!open || !client) return;
    let active = true;
    setLoading(true);
    setError(null);
    setQuery("");
    setBusyId(null);
    client
      .listRooms()
      .then((all) => {
        if (active) setRooms(all.filter((room) => room.id !== sourceRoomId));
      })
      .catch((err) => {
        if (active) setError(messageFromUnknown(err, "Failed to load rooms"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, client, sourceRoomId]);

  const visible = query.trim()
    ? rooms.filter((room) => room.name.toLowerCase().includes(query.trim().toLowerCase()))
    : rooms;

  async function forwardTo(room: ForwardTarget) {
    if (!client || messageId == null || busyId) return;
    setBusyId(room.id);
    setError(null);
    try {
      await client.forwardMessageRest(messageId, room.id);
      onForwarded?.(room.id);
      onClose();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to forward message"));
      setBusyId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent data-testid="forward-message-dialog">
        <DialogHeader>
          <DialogTitle>Forward message</DialogTitle>
          <DialogDescription>Pick the room to forward this message to.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <input
            className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
            placeholder="Filter rooms…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            data-testid="forward-room-filter"
          />
        </div>

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading rooms…
          </p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {!loading && visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rooms to forward to.</p>
        ) : null}
        <ul className="max-h-72 space-y-1 overflow-y-auto" data-testid="forward-room-list">
          {visible.map((room) => (
            <li key={room.id}>
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-start gap-2"
                disabled={busyId != null}
                onClick={() => void forwardTo(room)}
              >
                {busyId === room.id ? <Loader2 className="size-4 animate-spin" /> : null}
                <span className="truncate font-medium">{room.name}</span>
                {room.type ? (
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {room.type}
                  </span>
                ) : null}
              </Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
