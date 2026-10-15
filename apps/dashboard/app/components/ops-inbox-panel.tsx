"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button, Section } from "./ui";
import { messageFromUnknown } from "@/lib/error-message";
import {
  opsCompleteTask,
  opsDecideApproval,
  opsInbox,
  opsListApprovals,
  opsPublish,
} from "@/lib/ops-client";

interface OpsInboxPanelProps {
  memberJwt: string;
}

export function OpsInboxPanel({ memberJwt }: OpsInboxPanelProps) {
  const [tasks, setTasks] = useState<Array<{ id: string; runId: string; stepId: string; role?: string }>>([]);
  const [approvals, setApprovals] = useState<
    Array<{ id: string; stepId?: string; runId?: string; payloadHash?: string; payload?: { versionId?: string } }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!memberJwt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const [inbox, pending] = await Promise.all([opsInbox(memberJwt), opsListApprovals(memberJwt)]);
      setTasks(inbox.items || []);
      setApprovals(pending.items || []);
    } catch (err) {
      setError(messageFromUnknown(err, "Could not load process tasks"));
    } finally {
      setLoading(false);
    }
  }, [memberJwt]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 20_000);
    return () => clearInterval(t);
  }, [load]);

  if (!memberJwt.trim()) return null;

  return (
    <Section
      title="Process tasks"
      description="Human steps and publish approvals. Writes stay blocked until the hashed payload is approved."
      actions={
        <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
          Refresh
        </Button>
      }
    >
      {error ? <p className="mb-2 text-sm text-red-800 dark:text-red-200">{error}</p> : null}
      {loading && !tasks.length && !approvals.length ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading
        </p>
      ) : null}
      {approvals.length === 0 && tasks.length === 0 && !loading ? (
        <p className="text-sm text-muted-foreground">
          No process work waiting.{" "}
          <Link href="/ops" className="underline">
            Describe a process
          </Link>
        </p>
      ) : null}
      <ul className="space-y-2">
        {approvals.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
            <span>{row.stepId === "publish" ? "Publish process" : `Approve ${row.stepId || "step"}`}</span>
            <Button
              type="button"
              size="sm"
              disabled={busy === row.id}
              onClick={async () => {
                setBusy(row.id);
                try {
                  await opsDecideApproval(memberJwt, row.id, "approve", row.payloadHash);
                  if (row.stepId === "publish") await opsPublish(memberJwt, row.id);
                  await load();
                } catch (err) {
                  setError(messageFromUnknown(err, "Approval failed"));
                } finally {
                  setBusy(null);
                }
              }}
            >
              Approve
            </Button>
          </li>
        ))}
        {tasks.map((task) => (
          <li key={task.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
            <span>
              {task.stepId} · {task.runId.slice(0, 8)}
              {task.role ? ` · ${task.role}` : ""}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy === task.id}
              onClick={async () => {
                setBusy(task.id);
                try {
                  await opsCompleteTask(memberJwt, task.id);
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
    </Section>
  );
}
