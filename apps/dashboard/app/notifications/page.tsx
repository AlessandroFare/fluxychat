"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import { useState } from "react";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { useNotifications } from "@fluxy-chat/react";
import { Badge } from "@/components/ui/badge";
import { useClerkUser } from "@/lib/clerk-user";
import { fluxyUserIdFromClerk } from "@/lib/fluxy-clerk-user";
import { readJwtSub } from "@/lib/jwt-claims";
import { useDashboardSession } from "../components/dashboard-session";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { RoomPicker } from "../components/room-picker";
import { RoomOfflineNotifySettings } from "../components/room-offline-notify-settings";
import { DigestPreferencesCard } from "../components/digest-preferences-card";
import { QuietHoursCard } from "../components/quiet-hours-card";
import { Banner, Button, EmptyState, Panel, SkeletonCard } from "../components/ui";
import { formatDateTime } from "@/lib/format-datetime";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { cn } from "@/lib/utils";

const WORKER_URL = getPublicWorkerUrl();

function kindLabel(kind: string): string {
  if (kind === "mention") return "Mention";
  if (kind === "dm") return "Direct message";
  if (kind === "digest") return "Daily digest";
  if (kind === "batch") return "Batched alerts";
  return kind;
}

export default function NotificationsPage() {
  const router = useRouter();
  const { adminJwt, memberJwt, activeProject, lastRoom } = useDashboardSession();
  const { user: clerkUser } = useClerkUser();
  const memberToken = memberJwt.trim();
  const token = memberToken || adminJwt.trim();
  const [smsRoomId, setSmsRoomId] = useState(lastRoom?.id ?? "");
  const memberUserId =
    (clerkUser?.id ? fluxyUserIdFromClerk(clerkUser.id) : null) ??
    readJwtSub(memberToken) ??
    "";

  const client = useMemo(() => {
    if (!token) return null;
    return new FluxyChatClient({
      baseUrl: WORKER_URL,
      userId: "console",
      token,
    });
  }, [token]);

  const {
    notifications,
    unreadCount,
    loading,
    error,
    reload,
    markRead,
    markAllRead,
  } = useNotifications(client, { limit: 80, pollMs: 30_000 });

  return (
    <ConsoleShell className="max-w-2xl">
      <ConsolePageHeader
        title="Notifications"
        description={
          <>
            In-app alerts for mentions and DMs in project{" "}
            <code>{activeProject?.name || "none"}</code>. Requires migration{" "}
            <code className="text-[11px]">0037_in_app_notifications</code> on your Worker D1.
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => void reload()} disabled={loading || !client}>
          <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
          Refresh
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void markAllRead()}
          disabled={!client || unreadCount === 0}
        >
          <CheckCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Mark all read
        </Button>
        {unreadCount > 0 ? (
          <Badge variant="secondary" className="ml-auto">
            {unreadCount} unread
          </Badge>
        ) : null}
      </div>

      {error ? <Banner variant="error">{error}</Banner> : null}

      {memberToken ? (
        <DigestPreferencesCard token={memberToken} />
      ) : null}

      {memberToken ? (
        <QuietHoursCard token={memberToken} />
      ) : null}

      {memberToken && token ? (
        <Panel className="mb-6 p-4">
          <h2 className="text-sm font-semibold text-foreground">Offline SMS preferences</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Per-room opt-in for Sent.dm when you are idle. Requires a member JWT (not admin-only).
          </p>
          <div className="mt-3 max-w-md">
            <RoomPicker
              value={smsRoomId}
              onChange={setSmsRoomId}
              token={token}
              placeholder="Select room"
            />
          </div>
          {smsRoomId.trim() ? (
            <RoomOfflineNotifySettings
              className="mt-3 border-0 bg-muted/20 p-0 shadow-none"
              compact
              roomId={smsRoomId}
              memberJwt={memberToken}
              memberUserId={memberUserId || undefined}
            />
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Choose a room to edit SMS settings.</p>
          )}
        </Panel>
      ) : (
        <Banner variant="info">
          Mint a <strong>member</strong> JWT in Quickstart to configure offline SMS per room. Admin JWT
          alone cannot set your phone preferences.
        </Banner>
      )}

      {!token ? (
        <EmptyState
          icon={Bell}
          title="Connect a session"
          description="Mint a member JWT in Quickstart or Projects, then return here."
          action={{
            label: "Open quickstart",
            onClick: () => router.push("/onboarding"),
          }}
        />
      ) : loading && notifications.length === 0 ? (
        <div className="space-y-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          description="When someone @mentions you or sends a DM, entries appear here."
        />
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => (
            <li key={n.id}>
              <Panel
                className={cn(
                  "p-4 transition-colors",
                  !n.read_at && "border-primary/25 bg-primary/[0.03]",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{n.title}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {kindLabel(n.kind)}
                      </Badge>
                    </div>
                    {n.body ? (
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{n.body}</p>
                    ) : null}
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {formatDateTime(n.created_at)}
                      {n.room_id ? (
                        <>
                          {" · room "}
                          <code className="font-mono text-[10px]">{n.room_id}</code>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
                    {n.room_id ? (
                      <Link
                        href={`/rooms?room=${encodeURIComponent(n.room_id)}`}
                        className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-muted"
                      >
                        Open room
                      </Link>
                    ) : null}
                    {!n.read_at ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => void markRead(n.id)}>
                        Mark read
                      </Button>
                    ) : (
                      <span className="self-center text-xs text-muted-foreground">Read</span>
                    )}
                  </div>
                </div>
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </ConsoleShell>
  );
}
