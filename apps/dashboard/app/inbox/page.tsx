"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Inbox, Bell, Clock, Pin, RefreshCw } from "lucide-react";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { useInbox, type FluxyInboxItem } from "@fluxy-chat/react";
import { useDashboardSession } from "../components/dashboard-session";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { ApprovalsInboxPanel } from "../components/approvals-inbox-panel";
import { Banner, Button, EmptyState, Panel, SkeletonCard } from "../components/ui";
import { formatDateTime } from "@/lib/format-datetime";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { cn } from "@/lib/utils";

type InboxTab = "all" | "mentions" | "unread" | "snoozed" | "followups";

export default function InboxPage() {
  const router = useRouter();
  const { memberJwt, adminJwt } = useDashboardSession();
  const token = memberJwt.trim() || adminJwt.trim();
  const [tab, setTab] = useState<InboxTab>("all");
  const [followNote, setFollowNote] = useState("");
  const [followRoomId, setFollowRoomId] = useState("");
  const [liveItems, setLiveItems] = useState<FluxyInboxItem[]>([]);

  const onInboxItem = useCallback((item: FluxyInboxItem) => {
    setLiveItems((prev) => {
      if (prev.some((row) => row.id === item.id)) return prev;
      return [item, ...prev].slice(0, 8);
    });
  }, []);

  const client = useMemo(() => {
    if (!token) return null;
    return new FluxyChatClient({
      baseUrl: getPublicWorkerUrl(),
      userId: "console",
      token,
    });
  }, [token]);

  const {
    summary: data,
    items,
    unseen,
    isLoading: loading,
    error: inboxError,
    reload,
    counter: unreadCounter,
  } = useInbox({
    client,
    pollIntervalMs: 30_000,
    enabled: Boolean(client),
    onItem: onInboxItem,
  });

  const error = inboxError?.message ?? null;

  async function handleMarkRead(roomId: string, messageId: number) {
    if (!client) return;
    await client.markReadRest(roomId, messageId);
    await reload();
  }

  function resolveMarkReadMessageId(room: {
    firstUnreadMessageId: number | null;
    lastReadMessageId: number;
    lastMessage?: { messageId: number } | null;
  }): number | null {
    if (room.firstUnreadMessageId != null) return room.firstUnreadMessageId;
    if (room.lastMessage?.messageId != null) return room.lastMessage.messageId;
    if (room.lastReadMessageId > 0) return room.lastReadMessageId;
    return null;
  }

  const kindLabel: Record<FluxyInboxItem["kind"], string> = {
    mention: "Mention",
    unread: "Unread",
    follow_up: "Follow-up",
    snooze: "Snoozed",
  };

  async function handleSnooze(roomId: string, hours: number) {
    if (!client) return;
    await client.snoozeRoom(roomId, { hours });
    await reload();
  }

  async function handleUnsnooze(roomId: string) {
    if (!client) return;
    await client.unsnoozeRoom(roomId);
    await reload();
  }

  async function handleAddFollowUp() {
    if (!client || !followRoomId.trim()) return;
    await client.createInboxFollowUp({
      roomId: followRoomId.trim(),
      note: followNote.trim() || null,
    });
    setFollowNote("");
    setFollowRoomId("");
    await reload();
  }

  async function handleCompleteFollowUp(id: string) {
    if (!client) return;
    await client.completeInboxFollowUp(id);
    await reload();
  }

  const tabs: { id: InboxTab; label: string; count: number }[] = [
    { id: "all", label: "All", count: 0 },
    { id: "mentions", label: "Mentions", count: data?.counts.mentions ?? 0 },
    { id: "unread", label: "Unread", count: data?.counts.unreadRooms ?? 0 },
    { id: "snoozed", label: "Snoozed", count: data?.counts.snoozedRooms ?? 0 },
    { id: "followups", label: "Follow-ups", count: data?.counts.followUps ?? 0 },
  ];

  return (
    <ConsoleShell className="max-w-3xl">
      <ConsolePageHeader
        title="Inbox"
        description={`Mentions, unread rooms, snoozed channels, and follow-ups.${unreadCounter > 0 ? ` ${unreadCounter} unread room${unreadCounter === 1 ? "" : "s"}.` : ""}${unseen > 0 ? ` ${unseen} in view.` : ""}`}
      />

      {token ? (
        <div className="mb-8">
          <ApprovalsInboxPanel memberJwt={token} />
        </div>
      ) : null}

      {tab === "all" && items.length > 0 ? (
        <section className="mb-6" data-testid="inbox-items-feed">
          <h2 className="mb-2 text-sm font-semibold">Items feed</h2>
          <ul className="space-y-2">
            {items.slice(0, 12).map((item) => (
              <li key={item.id}>
                <Panel className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-primary">{kindLabel[item.kind]}</p>
                    <Link
                      href={`/rooms?room=${encodeURIComponent(item.roomId)}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {item.roomName ?? item.roomId}
                    </Link>
                    {item.unreadCount != null ? (
                      <p className="mt-1 text-xs text-muted-foreground">{item.unreadCount} unread</p>
                    ) : null}
                  </div>
                  {item.kind === "unread" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      data-testid={`inbox-mark-read-${item.roomId}`}
                      onClick={() => {
                        const payload = item.payload as {
                          firstUnreadMessageId?: number | null;
                          lastReadMessageId?: number;
                          lastMessage?: { messageId: number } | null;
                        };
                        const messageId = resolveMarkReadMessageId({
                          firstUnreadMessageId: payload.firstUnreadMessageId ?? null,
                          lastReadMessageId: payload.lastReadMessageId ?? 0,
                          lastMessage: payload.lastMessage ?? null,
                        });
                        if (messageId != null) void handleMarkRead(item.roomId, messageId);
                      }}
                    >
                      Mark read
                    </Button>
                  ) : null}
                </Panel>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {liveItems.length > 0 ? (
        <div className="mb-4 space-y-2" data-testid="inbox-live-items">
          {liveItems.map((item) => (
            <Panel key={item.id} className="border-primary/30 bg-primary/[0.04] p-3" data-testid="inbox-live-item">
              <p className="text-xs font-medium text-primary">Live · {item.kind}</p>
              <p className="text-sm text-foreground">
                {item.roomName ?? item.roomId}
                {item.unreadCount != null ? ` · ${item.unreadCount} unread` : ""}
              </p>
            </Panel>
          ))}
        </div>
      ) : null}

      {items.length > 0 ? (
        <p className="mb-2 text-xs text-muted-foreground" data-testid="inbox-items-count">
          {items.length} item{items.length === 1 ? "" : "s"} in feed
        </p>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => void reload()} disabled={loading || !client}>
          <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
          Refresh
        </Button>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              tab === t.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted/50",
            )}
          >
            {t.label}
            {t.id !== "all" && t.count > 0 ? ` (${t.count})` : ""}
          </button>
        ))}
      </div>

      {error ? <Banner variant="error">{error}</Banner> : null}

      {!token ? (
        <EmptyState
          icon={Inbox}
          title="Connect a session"
          description="Mint a member JWT in Quickstart to load your unified inbox."
          action={{ label: "Open quickstart", onClick: () => router.push("/onboarding") }}
        />
      ) : loading && !data ? (
        <div className="space-y-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : !data ? (
        <EmptyState icon={Inbox} title="No inbox data" description="Try refreshing." />
      ) : (
        <div className="space-y-6">
          {(tab === "all" || tab === "mentions") && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Bell className="h-4 w-4" aria-hidden />
                Mentions of you
              </h2>
              {data.mentions.length === 0 ? (
                <p className="text-xs text-muted-foreground">No recent @mentions.</p>
              ) : (
                <ul className="space-y-2">
                  {data.mentions.map((m) => (
                    <li key={`${m.roomId}-${m.messageId}`}>
                      <Panel className={cn("p-4", m.isUnread && "border-primary/25 bg-primary/[0.03]")}>
                        <p className="text-sm text-foreground">{m.preview}</p>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          {m.authorId} in{" "}
                          <Link href={`/rooms?room=${encodeURIComponent(m.roomId)}`} className="text-brand underline underline-offset-2">
                            {m.roomName}
                          </Link>{" "}
                          · {formatDateTime(m.createdAt)}
                          {m.isUnread ? " · unread" : ""}
                        </p>
                      </Panel>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {(tab === "all" || tab === "unread") && (
            <section>
              <h2 className="mb-2 text-sm font-semibold">Unread rooms</h2>
              {data.unreadRooms.length === 0 ? (
                <p className="text-xs text-muted-foreground">You are caught up.</p>
              ) : (
                <ul className="space-y-2">
                  {data.unreadRooms.map((r) => (
                    <li key={r.roomId}>
                      <Panel className="flex flex-wrap items-start justify-between gap-3 p-4">
                        <div className="min-w-0">
                          <Link href={`/rooms?room=${encodeURIComponent(r.roomId)}`} className="font-medium text-foreground hover:underline">
                            {r.roomName}
                          </Link>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {r.unreadCount} unread
                            {r.lastMessage?.preview ? ` · ${r.lastMessage.preview}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const messageId = resolveMarkReadMessageId(r);
                              if (messageId != null) void handleMarkRead(r.roomId, messageId);
                            }}
                          >
                            Mark read
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => void handleSnooze(r.roomId, 24)}>
                            Snooze 24h
                          </Button>
                        </div>
                      </Panel>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {(tab === "all" || tab === "snoozed") && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Clock className="h-4 w-4" aria-hidden />
                Snoozed
              </h2>
              {data.snoozedRooms.length === 0 ? (
                <p className="text-xs text-muted-foreground">No snoozed rooms.</p>
              ) : (
                <ul className="space-y-2">
                  {data.snoozedRooms.map((r) => (
                    <li key={r.roomId}>
                      <Panel className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <div>
                          <span className="font-medium">{r.roomName}</span>
                          <p className="text-xs text-muted-foreground">
                            Until {r.snoozedUntil ? formatDateTime(r.snoozedUntil) : ""}
                          </p>
                        </div>
                        <Button type="button" size="sm" variant="outline" onClick={() => void handleUnsnooze(r.roomId)}>
                          Unsnooze
                        </Button>
                      </Panel>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {(tab === "all" || tab === "followups") && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Pin className="h-4 w-4" aria-hidden />
                Follow-ups
              </h2>
              <Panel className="mb-3 flex flex-col gap-2 p-4 sm:flex-row">
                <input
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Room id"
                  value={followRoomId}
                  onChange={(e) => setFollowRoomId(e.target.value)}
                />
                <input
                  className="min-w-0 flex-[2] rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Note (optional)"
                  value={followNote}
                  onChange={(e) => setFollowNote(e.target.value)}
                />
                <Button type="button" size="sm" onClick={() => void handleAddFollowUp()} disabled={!followRoomId.trim()}>
                  Add
                </Button>
              </Panel>
              {data.followUps.length === 0 ? (
                <p className="text-xs text-muted-foreground">No open follow-ups.</p>
              ) : (
                <ul className="space-y-2">
                  {data.followUps.map((f) => (
                    <li key={f.id}>
                      <Panel className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <div>
                          <Link href={`/rooms?room=${encodeURIComponent(f.roomId)}`} className="font-medium hover:underline">
                            {f.roomName}
                          </Link>
                          {f.note ? <p className="mt-1 text-sm text-muted-foreground">{f.note}</p> : null}
                          {f.dueAt ? (
                            <p className="mt-1 text-[11px] text-muted-foreground">Due {formatDateTime(f.dueAt)}</p>
                          ) : null}
                        </div>
                        <Button type="button" size="sm" variant="outline" onClick={() => void handleCompleteFollowUp(f.id)}>
                          Done
                        </Button>
                      </Panel>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}
    </ConsoleShell>
  );
}
