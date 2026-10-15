"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck, Loader2, Square } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { Banner, Button, EmptyState, Input, Section } from "../../components/ui";
import { useDashboardSession } from "../../components/dashboard-session";
import { messageFromUnknown } from "@/lib/error-message";
import { opsCompleteTask, opsInbox, opsInviteGuest, opsKillRun, opsListRuns, type OpsRunRow } from "@/lib/ops-client";
import { formatDateTime } from "@/lib/format-datetime";

export default function OpsRunsPage() {
  const { memberJwt, adminJwt, activeProject } = useDashboardSession();
  const token = memberJwt.trim() || adminJwt.trim();
  const [runs, setRuns] = useState<OpsRunRow[]>([]);
  const [tasks, setTasks] = useState<Array<{ id: string; runId: string; stepId: string; role?: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [guestEmail, setGuestEmail] = useState("");

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [r, i] = await Promise.all([opsListRuns(token), opsInbox(token)]);
      setRuns((r.runs || []) as OpsRunRow[]);
      setTasks(i.items || []);
    } catch (err) {
      setError(messageFromUnknown(err, "Could not load runs"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ConsoleShell>
      <ConsolePageHeader
        icon={ClipboardCheck}
        title="Process runs"
        description="Each run is a room. Complete tasks assigned to you. High-risk writes stay blocked until you approve the exact payload."
        actions={
          <Link
            href="/ops"
            className="inline-flex h-7 items-center rounded-md border border-border bg-background px-2.5 text-xs font-semibold hover:bg-muted/60"
          >
            New process
          </Link>
        }
      />
      {error ? <Banner variant="error">{error}</Banner> : null}
      {notice ? <Banner variant="info">{notice}</Banner> : null}
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading
        </p>
      ) : null}

      <Section title="Assigned to you" description="Human steps and approvals across every process.">
        {tasks.length === 0 ? (
          <EmptyState title="No open tasks" description="When a process needs you, it shows up here and in Inbox." />
        ) : (
          <ul className="space-y-2">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                <span>
                  {task.stepId} in run {task.runId.slice(0, 8)}
                  {task.role ? ` · ${task.role}` : ""}
                </span>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy === task.id}
                  onClick={async () => {
                    setBusy(task.id);
                    try {
                      await opsCompleteTask(token, task.id);
                      await load();
                    } catch (err) {
                      setError(messageFromUnknown(err, "Could not complete task"));
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  Done
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="All runs">
        {runs.length === 0 ? (
          <EmptyState title="No runs yet" description="Publish a draft from Processes, then start a run." />
        ) : (
          <ul className="space-y-2">
            {runs.map((run) => (
              <li key={run.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{run.id}</p>
                  <p className="text-muted-foreground">
                    {run.status}
                    {run.updatedAt ? ` · ${formatDateTime(run.updatedAt)}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === run.id || run.status === "cancelled"}
                  onClick={async () => {
                    setBusy(run.id);
                    try {
                      await opsKillRun(token, run.id);
                      await load();
                    } catch (err) {
                      setError(messageFromUnknown(err, "Kill switch failed"));
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  <Square className="mr-1 h-3 w-3" /> Stop
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Invite an external reviewer" description="They get upload or comment rights only — never process admin and never write approval.">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="guest@partner.example"
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
          />
          <Button
            type="button"
            size="sm"
            disabled={!token || !guestEmail.trim() || !runs[0] || busy === "guest"}
            onClick={async () => {
              const runId = runs[0]?.id;
              if (!runId) return;
              setBusy("guest");
              setNotice(null);
              try {
                const issued = await opsInviteGuest(token, { runId, email: guestEmail.trim(), can: ["comment", "upload_file"] });
                const projectId = activeProject?.id || "";
                const url = issued.token
                  ? `${window.location.origin}/ops/guest?projectId=${encodeURIComponent(projectId)}&token=${encodeURIComponent(issued.token)}`
                  : "";
                setNotice(url || "Invite created. Copy the token from the Worker response.");
                if (url && navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
              } catch (err) {
                setError(messageFromUnknown(err, "Could not invite guest"));
              } finally {
                setBusy(null);
              }
            }}
          >
            Send scoped link
          </Button>
        </div>
      </Section>
    </ConsoleShell>
  );
}
