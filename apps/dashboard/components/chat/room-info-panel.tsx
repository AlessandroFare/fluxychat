"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Info, Loader2, Pin, Shield, Users, X } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { formatDateTime } from "@/lib/format-datetime";
import { messageFromUnknown } from "@/lib/error-message";
import { fetchRoomInfoPanel, type RoomInfoPanelData } from "@/lib/room-info-client";
import { cn } from "@/lib/utils";

interface RoomInfoPanelProps {
  roomId: string;
  token: string;
  open: boolean;
  onClose: () => void;
  onJumpToMessage?: (messageId: number) => void;
  className?: string;
}

export function RoomInfoPanel({
  roomId,
  token,
  open,
  onClose,
  onJumpToMessage,
  className,
}: RoomInfoPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RoomInfoPanelData | null>(null);

  const load = useCallback(async () => {
    if (!token.trim() || !roomId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchRoomInfoPanel(token, roomId));
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load room info"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [roomId, token]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  if (!open) return null;

  return (
    <aside
      className={cn(
        "absolute inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l border-border bg-background shadow-xl",
        className,
      )}
      aria-label="Room information"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Info className="size-4" />
          Room info
        </div>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={onClose}
          aria-label="Close room info"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 text-sm">
        {loading ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading…
          </p>
        ) : null}
        {error ? <p className="text-destructive">{error}</p> : null}
        {data?.room ? (
          <div className="space-y-4">
            <section>
              <h3 className="font-semibold">{data.room.name || data.room.id}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {data.room.type} · {data.messageCount} messages · created {formatDateTime(data.room.createdAt)}
              </p>
              {data.room.description ? (
                <p className="mt-2 text-xs text-foreground/80">{data.room.description}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {data.room.e2eEnabled ? (
                  <Badge variant="secondary" className="gap-1">
                    <Shield className="size-3" /> E2E
                  </Badge>
                ) : null}
                {data.live ? (
                  <Badge variant="outline">{data.live.online} online</Badge>
                ) : null}
              </div>
            </section>

            <section>
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Users className="size-3.5" />
                Members ({data.memberCount})
              </h4>
              <ul className="space-y-1">
                {data.members.slice(0, 20).map((m) => (
                  <li key={m.userId} className="flex items-center justify-between rounded-md bg-muted/40 px-2 py-1 text-xs">
                    <span className="truncate font-medium">{m.userId}</span>
                    <span className="text-muted-foreground">{m.role}</span>
                  </li>
                ))}
              </ul>
            </section>

            {data.retention ? (
              <section>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Retention</h4>
                <p className="text-xs">
                  {data.retention.mode}
                  {data.retention.ttlSeconds ? ` · TTL ${data.retention.ttlSeconds}s` : ""}
                </p>
                <Link href="/settings/ephemeral" className="mt-1 inline-block text-xs text-brand underline underline-offset-2">
                  Retention settings
                </Link>
              </section>
            ) : null}

            {data.pins.length ? (
              <section>
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Pin className="size-3.5" />
                  Pinned ({data.pins.length})
                </h4>
                <ul className="space-y-1">
                  {data.pins.map((p) => (
                    <li key={p.messageId}>
                      <button
                        type="button"
                        className="text-xs text-brand underline underline-offset-2"
                        onClick={() => onJumpToMessage?.(p.messageId)}
                      >
                        Message #{p.messageId}
                      </button>
                      <span className="ml-1 text-muted-foreground">· {formatDateTime(p.pinnedAt)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="border-t border-border pt-3 text-xs text-muted-foreground">
              <Link href={`/settings/e2e?room=${encodeURIComponent(roomId)}`} className="text-brand underline underline-offset-2">
                E2E settings
              </Link>
              {" · "}
              <Link href={`/settings/translation?room=${encodeURIComponent(roomId)}`} className="text-brand underline underline-offset-2">
                Translation
              </Link>
            </section>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export function RoomInfoToggle({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
      aria-label="Open room info"
    >
      <Info className="size-3.5" />
      Info
    </button>
  );
}
