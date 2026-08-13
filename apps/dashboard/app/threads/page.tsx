"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { MessageSquare, RefreshCw } from "lucide-react";
import { useDashboardSession } from "../components/dashboard-session";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { Banner, Button, EmptyState, Panel, SkeletonCard } from "../components/ui";
import { Badge } from "~/components/ui/badge";
import { formatDateTime } from "@/lib/format-datetime";
import { messageFromUnknown } from "@/lib/error-message";
import {
  listMyThreads,
  threadDeepLink,
  type ThreadListItem,
} from "@/lib/threads-client";
import { cn } from "@/lib/utils";

type ThreadsTab = "all" | "unread";

export default function ThreadsPage() {
  const router = useRouter();
  const { memberJwt, adminJwt } = useDashboardSession();
  const token = memberJwt.trim() || adminJwt.trim();

  const [tab, setTab] = useState<ThreadsTab>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadListItem[]>([]);

  const loadThreads = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setThreads([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await listMyThreads(token, {
        limit: 50,
        unreadOnly: tab === "unread",
      });
      setThreads(data.threads ?? []);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load threads"));
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, [token, tab]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  const unreadTotal = threads.reduce((sum, t) => sum + (t.unreadCount > 0 ? t.unreadCount : 0), 0);

  return (
    <ConsoleShell className="max-w-3xl">
      <ConsolePageHeader
        title="Threads"
        description="Reply threads you participate in, with unread counts and jump to the parent message."
      />

      {!token ? (
        <EmptyState
          icon={MessageSquare}
          title="Connect a session"
          description="Mint a JWT in Quickstart to list your reply threads across rooms."
          action={{
            label: "Open quickstart",
            onClick: () => router.push("/onboarding"),
          }}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {(["all", "unread"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                  tab === value
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {value === "all" ? "All threads" : "Unread"}
                {value === "unread" && unreadTotal > 0 ? (
                  <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
                    {unreadTotal > 99 ? "99+" : unreadTotal}
                  </span>
                ) : null}
              </button>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => void loadThreads()}
              disabled={loading}
            >
              <RefreshCw className={cn("mr-1.5 size-3.5", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>

          {error ? <Banner variant="error" className="mb-4">{error}</Banner> : null}

          {loading ? (
            <div className="space-y-2">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : threads.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title={tab === "unread" ? "No unread threads" : "No threads yet"}
              description={
                tab === "unread"
                  ? "You're caught up on every thread you've joined."
                  : "Reply to a message in chat to start a thread. It will show up here."
              }
              action={{
                label: "Open rooms",
                onClick: () => router.push("/rooms"),
              }}
            />
          ) : (
            <ul className="space-y-2">
              {threads.map((thread) => (
                <li key={`${thread.roomId}:${thread.rootMessageId}`}>
                  <Panel className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground line-clamp-2">
                          {thread.rootPreview || "(empty message)"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {thread.rootUserId} · room{" "}
                          <Link
                            href={`/rooms?room=${encodeURIComponent(thread.roomId)}`}
                            className="text-brand underline underline-offset-2"
                          >
                            {thread.roomId}
                          </Link>
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {thread.replyCount} repl{thread.replyCount === 1 ? "y" : "ies"} · last by{" "}
                          {thread.lastReply.userId} · {formatDateTime(thread.lastReply.createdAt)}
                        </p>
                        {thread.lastReply.preview ? (
                          <p className="mt-1 text-xs text-foreground/80 line-clamp-1">
                            ↳ {thread.lastReply.preview}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        {thread.unreadCount > 0 ? (
                          <Badge variant="default">
                            {thread.unreadCount} unread
                          </Badge>
                        ) : null}
                        <Link
                          href={threadDeepLink(thread.roomId, thread.rootMessageId)}
                          className="text-xs font-medium text-brand underline underline-offset-2"
                        >
                          Open thread
                        </Link>
                      </div>
                    </div>
                  </Panel>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </ConsoleShell>
  );
}
