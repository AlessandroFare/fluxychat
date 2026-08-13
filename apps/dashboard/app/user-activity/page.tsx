"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { ConsoleFeedback } from "../components/console-feedback";
import { Banner, Button, EmptyState, Panel, Section } from "../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../components/dashboard-session";
import { formatDateTime } from "@/lib/format-datetime";
import { messageFromUnknown } from "@/lib/error-message";
import {
  listUserActivityFeed,
  markActivityFeedRead,
  type ActivityFeedItem,
} from "@/lib/activity-feed-client";

export default function UserActivityFeedPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ActivityFeedItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await listUserActivityFeed(token, { limit: 50 });
      setItems(data.items);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load activity feed"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markAllRead() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await markActivityFeedRead(token);
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to mark as read"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Activity feed"
        description="Cross-room mentions and notifications for your account."
        icon={Bell}
      />
      <ConsoleFeedback error={error} />
      <Section title="Recent activity">
        <Panel>
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
            <Badge variant="secondary">{unreadCount} unread</Badge>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || unreadCount === 0}
              onClick={() => void markAllRead()}
            >
              {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCheck className="mr-1 h-3 w-3" />}
              Mark all read
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => void load()}>
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="No activity yet"
              description="Mentions and cross-room events will appear here."
            />
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      {item.body ? (
                        <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{item.body}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDateTime(item.createdAt)}
                        {item.roomId ? ` · room ${item.roomId.slice(0, 8)}…` : ""}
                      </p>
                    </div>
                    {item.unread ? <Badge>New</Badge> : null}
                  </div>
                  {item.roomId ? (
                    <Link
                      href={`/rooms/${item.roomId}`}
                      className="mt-2 inline-block text-xs text-primary hover:underline"
                    >
                      Open room
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </Section>
      {!token ? (
        <Banner variant="warning">Sign in to view your personal activity feed.</Banner>
      ) : null}
    </ConsoleShell>
  );
}
