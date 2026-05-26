"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { Badge } from "@/components/ui/badge";
import { useDashboardSession } from "../components/dashboard-session";
import { RoomPicker } from "../components/room-picker";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { Banner, Button, EmptyState, Panel, SkeletonCard } from "../components/ui";
import { formatDateTime } from "@/lib/format-datetime";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { messageFromUnknown } from "@/lib/error-message";
import { cn } from "@/lib/utils";

const WORKER_URL = getPublicWorkerUrl();

interface ActivityRow {
  id: string;
  kind: "automation" | "webhook" | "agent_run";
  title: string;
  status: string;
  roomId?: string;
  createdAt: string;
  detail?: string;
}

function kindLabel(kind: ActivityRow["kind"]): string {
  if (kind === "webhook") return "Webhook";
  if (kind === "agent_run") return "Agent run";
  return "Automation";
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "failed" || status === "error") return "destructive";
  if (status === "delivered" || status === "completed" || status === "sent") return "default";
  return "secondary";
}

export default function ActivitiesPage() {
  const { adminJwt, memberJwt, activeProject } = useDashboardSession();
  const token = memberJwt.trim() || adminJwt.trim();
  const [roomId, setRoomId] = useState("");
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const client = React.useMemo(() => {
    if (!token) return null;
    return new FluxyChatClient({
      baseUrl: WORKER_URL,
      userId: "console",
      token,
    });
  }, [token]);

  const loadActivities = useCallback(async () => {
    if (!client) {
      setError("Connect a project session first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const activities = await client.listActivities({
        limit: 80,
        roomId: roomId.trim() || undefined,
      });
      setRows(
        activities.map((a) => ({
          id: a.id,
          kind: a.kind,
          title: a.title,
          status: a.status,
          roomId: a.roomId,
          createdAt: a.createdAt,
          detail: a.detail,
        })),
      );
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Failed to load activities"));
    } finally {
      setLoading(false);
    }
  }, [client, roomId]);

  useEffect(() => {
    if (token) void loadActivities();
  }, [token, loadActivities]);

  return (
    <ConsoleShell className="max-w-3xl">
      <ConsolePageHeader
        title="Activities"
        description={
          <>
            Recent webhooks, agent runs, and automation events. Project:{" "}
            <code>{activeProject?.name || "none"}</code>
          </>
        }
        actions={
          <Button variant="outline" onClick={() => void loadActivities()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
            Refresh
          </Button>
        }
      />

      {error ? <Banner variant="error">{error}</Banner> : null}

      <Panel className="mb-4 rounded-2xl border border-border/80 p-4">
        <label className="text-xs text-muted-foreground">
          Filter by room (optional)
          <div className="mt-1">
            <RoomPicker token={token} value={roomId} onChange={setRoomId} placeholder="All rooms" />
          </div>
        </label>
      </Panel>

      <Panel className="rounded-2xl border border-border/80 p-4">
        {loading ? (
          <SkeletonCard />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No activity yet"
            description="Send messages, invoke agents, or deliver webhooks to populate this feed."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className={cn(
                  "rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-sm",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{kindLabel(row.kind)}</Badge>
                    <span className="font-medium">{row.title}</span>
                    <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(row.createdAt)}
                  </span>
                </div>
                {row.roomId ? (
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    room: {row.roomId}
                  </p>
                ) : null}
                {row.detail ? (
                  <p className="mt-1 text-xs text-muted-foreground break-all">{row.detail}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </ConsoleShell>
  );
}
