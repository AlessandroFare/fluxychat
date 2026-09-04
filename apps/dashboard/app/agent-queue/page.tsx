"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Headphones, RefreshCw, Timer, UserCheck, Route, Clock } from "lucide-react";
import {
  FluxyChatClient,
  type FluxyAgentQueueSummary,
  type FluxyAgentTask,
} from "@fluxy-chat/sdk";
import { useDashboardSession } from "../components/dashboard-session";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { Banner, Button, EmptyState, Panel, SkeletonCard } from "../components/ui";
import { formatDateTime } from "@/lib/format-datetime";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { messageFromUnknown } from "@/lib/error-message";
import { cn } from "@/lib/utils";

function formatSla(task: FluxyAgentTask): string {
  if (task.slaBreached) return "SLA breached";
  const sec = task.secondsToSla;
  if (sec == null) return "";
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  return `${min}m`;
}

export default function AgentQueuePage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();
  const [data, setData] = useState<FluxyAgentQueueSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newRoomId, setNewRoomId] = useState("");
  const [newNote, setNewNote] = useState("");
  const [filter, setFilter] = useState<"all" | "mine">("all");
  const [dispositions, setDispositions] = useState<Array<{ code: string; label: string }>>([]);
  const [resolveDisposition, setResolveDisposition] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<{
    total: number;
    breakdown: Array<{ code: string; label: string; count: number }>;
  } | null>(null);

  // Generation counter for stale-response suppression in `reload`.
  const reloadGenRef = useRef(0);

  const client = useMemo(() => {
    if (!token) return null;
    return new FluxyChatClient({
      baseUrl: getPublicWorkerUrl(),
      userId: "console",
      token,
    });
  }, [token]);

  const reload = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setError(null);
    // Stale-response guard: bump a generation counter; if a newer reload
    // starts before this one resolves, ignore the result. Prevents rapid
    // filter toggles from landing out-of-order data. (Audit P2 fix — SDK
    // methods don't accept an AbortSignal today.)
    const gen = ++reloadGenRef.current;
    try {
      const [summary, dispositionList, dispositionStats] = await Promise.all([
        client.getAgentQueue({
          assignee: filter === "mine" ? "me" : "all",
        }),
        client.getAgentDispositions(),
        client.getAgentQueueStats(),
      ]);
      if (gen !== reloadGenRef.current) return;
      setData(summary);
      setDispositions(dispositionList?.dispositions ?? []);
      setStats(dispositionStats);
    } catch (err) {
      if (gen !== reloadGenRef.current) return;
      setError(messageFromUnknown(err, "Failed to load agent queue"));
    } finally {
      if (gen === reloadGenRef.current) setLoading(false);
    }
  }, [client, filter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleCreate() {
    if (!client || !newRoomId.trim()) return;
    await client.createAgentTask({
      roomId: newRoomId.trim(),
      note: newNote.trim() || null,
    });
    setNewRoomId("");
    setNewNote("");
    await reload();
  }

  async function handleClaim(taskId: string) {
    if (!client) return;
    await client.claimAgentTask(taskId);
    await reload();
  }

  async function handleRelease(taskId: string) {
    if (!client) return;
    await client.releaseAgentTask(taskId);
    await reload();
  }

  async function handleResolve(taskId: string) {
    if (!client) return;
    const disposition = resolveDisposition[taskId] || dispositions[0]?.code || "resolved";
    await client.resolveAgentTask(taskId, {
      status: "resolved",
      disposition,
    });
    await reload();
  }

  return (
    <ConsoleShell className="max-w-3xl">
      <ConsolePageHeader
        title="Agent queue"
        description="Claim rooms, track SLA timers, and resolve handoffs. Requires admin or moderator JWT."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void reload()} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      {!token && (
        <Banner variant="info">Sign in with an admin JWT to use the agent queue.</Banner>
      )}

      {error && <Banner variant="error">{error}</Banner>}

      {stats && stats.total > 0 ? (
        <Panel className="mt-3 space-y-2">
          <h2 className="text-sm font-medium text-foreground">Resolved breakdown</h2>
          <ul className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {stats.breakdown.map((row) => (
              <li key={row.code} className="rounded-full border border-border px-2 py-0.5">
                {row.label}: {row.count}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">Enqueue room</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="room_id"
            value={newRoomId}
            onChange={(e) => setNewRoomId(e.target.value)}
          />
          <input
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="Note (optional)"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
          />
          <Button onClick={() => void handleCreate()} disabled={!client || !newRoomId.trim()}>
            Add task
          </Button>
        </div>
      </Panel>

      <div className="mt-4 flex gap-2">
        <Button
          variant={filter === "all" ? "default" : "secondary"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          All open
        </Button>
        <Button
          variant={filter === "mine" ? "default" : "secondary"}
          size="sm"
          onClick={() => setFilter("mine")}
        >
          My claims
        </Button>
      </div>

      {loading && !data && (
        <div className="mt-4 space-y-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {data && (
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span>{data.counts.open} open</span>
          <span>{data.counts.claimed} claimed</span>
          <span className={data.counts.slaBreached > 0 ? "text-destructive" : ""}>
            {data.counts.slaBreached} SLA breached
          </span>
          <span>SLA {data.slaMinutes}m</span>
        </div>
      )}

      {data && data.tasks.length === 0 && (
        <EmptyState
          className="mt-6"
          icon={Headphones}
          title="Queue empty"
          description="No open or claimed tasks. Inbound telco can auto-enqueue when AGENT_QUEUE_AUTO_INBOUND is enabled."
        />
      )}

      <ul className="mt-4 space-y-3">
        {(data?.tasks ?? []).map((task) => (
          <li key={task.id}>
            <Panel className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link
                    href={`/rooms?room=${encodeURIComponent(task.roomId)}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {task.roomName || task.roomId}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {task.roomId} · {task.triggerSource}
                  </p>
                  {task.note && (
                    <p className="mt-1 text-sm text-muted-foreground">{task.note}</p>
                  )}
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    task.status === "open" && "bg-amber-500/15 text-amber-700 dark:text-amber-300",
                    task.status === "claimed" && "bg-blue-500/15 text-blue-700 dark:text-blue-300",
                  )}
                >
                  {task.status}
                </span>
              </div>

              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Timer className="h-3.5 w-3.5" />
                  {formatSla(task)} · due {formatDateTime(task.slaDueAt)}
                </span>
                {task.assigneeUserId && (
                  <span className="inline-flex items-center gap-1">
                    <UserCheck className="h-3.5 w-3.5" />
                    {task.assigneeUserId}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {task.status === "open" && (
                  <Button size="sm" onClick={() => void handleClaim(task.id)}>
                    Claim
                  </Button>
                )}
                {task.status === "claimed" && (
                  <>
                    <select
                      className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                      value={resolveDisposition[task.id] || dispositions[0]?.code || "resolved"}
                      onChange={(e) =>
                        setResolveDisposition((prev) => ({
                          ...prev,
                          [task.id]: e.target.value,
                        }))
                      }
                    >
                      {(dispositions.length
                        ? dispositions
                        : [{ code: "resolved", label: "Resolved" }]
                      ).map((d) => (
                        <option key={d.code} value={d.code}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                    <Button size="sm" variant="secondary" onClick={() => void handleRelease(task.id)}>
                      Release
                    </Button>
                    <Button size="sm" onClick={() => void handleResolve(task.id)}>
                      Resolve
                    </Button>
                  </>
                )}
              </div>
            </Panel>
          </li>
        ))}
      </ul>

      {/* Expert Routing SDK module */}
      <Panel className="mt-8 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <Route className="mt-0.5 h-5 w-5 text-blue-500" />
          <div>
            <h3 className="text-sm font-semibold">Expert Routing (createExpertRouter)</h3>
            <p className="text-xs text-muted-foreground">
              Skill-based agent routing with SLA policies. Score agents by skill match, load,
              language, and priority. Available as an SDK module.
            </p>
            <div className="mt-2 flex flex-wrap gap-4 text-[10px] text-muted-foreground">
              <span><strong>Skills:</strong> beginner / intermediate / expert</span>
              <span><strong>Priorities:</strong> low / normal / high / urgent</span>
              <span><strong>SLA:</strong> per-priority target seconds + escalation</span>
            </div>
          </div>
        </div>
      </Panel>

      {/* Waiting Room SDK module */}
      <Panel className="mt-4 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 h-5 w-5 text-amber-500" />
          <div>
            <h3 className="text-sm font-semibold">Virtual Waiting Room (createVirtualWaitingRoom)</h3>
            <p className="text-xs text-muted-foreground">
              Queue management for agent handoff with priority ordering, estimated wait time,
              abandon tracking, and real-time stats.
            </p>
            <div className="mt-2 flex flex-wrap gap-4 text-[10px] text-muted-foreground">
              <span><strong>Priorities:</strong> normal / VIP / urgent</span>
              <span><strong>Stats:</strong> avg/max wait, abandonment rate, agent availability</span>
              <span><strong>Actions:</strong> enqueue, dequeue, abandon, connect, peek</span>
            </div>
          </div>
        </div>
      </Panel>
    </ConsoleShell>
  );
}
