"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ChevronLeft, ChevronRight, RefreshCw, Zap } from "lucide-react";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
const PAGE_SIZE = 20;

interface ActivityRow {
  id: string;
  kind: "automation" | "webhook" | "agent_run";
  title: string;
  status: string;
  roomId?: string;
  createdAt: string;
  detail?: string;
}

type KindFilter = "all" | ActivityRow["kind"];

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
  const token = adminJwt.trim() || memberJwt.trim();
  const [roomId, setRoomId] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
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
        limit: 200,
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
      setPage(0);
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Failed to load activities"));
    } finally {
      setLoading(false);
    }
  }, [client, roomId]);

  useEffect(() => {
    if (token) void loadActivities();
  }, [token, loadActivities]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      if (kindFilter !== "all" && row.kind !== kindFilter) return false;
      if (!q) return true;
      const haystack = [row.title, row.status, row.detail, row.roomId, row.kind].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, kindFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageRows = filteredRows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => {
    if (page >= totalPages) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

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

      <Panel className="mb-4 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <Zap className="mt-0.5 h-5 w-5 text-amber-500" />
          <div>
            <h3 className="text-sm font-semibold">Automation Engine</h3>
            <p className="text-xs text-muted-foreground">
              IF-THEN rules with triggers (message, schedule, webhook, …) and actions (notify, escalate, log, …).
            </p>
          </div>
        </div>
      </Panel>

      <Panel className="mb-4 space-y-3 rounded-2xl p-4">
        <div>
          <label className="text-xs text-muted-foreground">Search</label>
          <Input
            className="mt-1"
            placeholder="Filter by title, status, room, detail…"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", "automation", "webhook", "agent_run"] as const).map((k) => (
            <Button
              key={k}
              size="sm"
              variant={kindFilter === k ? "default" : "outline"}
              onClick={() => {
                setKindFilter(k);
                setPage(0);
              }}
            >
              {k === "all" ? "All" : kindLabel(k)}
            </Button>
          ))}
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Room (optional)</label>
          <div className="mt-1">
            <RoomPicker token={token} value={roomId} onChange={setRoomId} placeholder="All rooms" />
          </div>
        </div>
      </Panel>

      <Panel className="rounded-2xl p-4">
        {loading ? (
          <SkeletonCard />
        ) : pageRows.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No activity yet"
            description="Send messages, invoke agents, or deliver webhooks to populate this feed."
          />
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {pageRows.map((row) => (
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
                    <p className="mt-1 break-all text-xs text-muted-foreground">{row.detail}</p>
                  ) : null}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
              <span>
                {filteredRows.length} result{filteredRows.length === 1 ? "" : "s"}
                {filteredRows.length !== rows.length ? ` (of ${rows.length})` : ""}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>
                <span>
                  Page {page + 1} / {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Panel>
    </ConsoleShell>
  );
}
