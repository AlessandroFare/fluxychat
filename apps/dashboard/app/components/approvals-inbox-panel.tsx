"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Inbox, Loader2, X } from "lucide-react";
import Link from "next/link";
import { Button, Section } from "./ui";
import { Badge } from "~/components/ui/badge";
import {
  fetchPendingApprovalsForMe,
  postApprovalDecision,
  type HitlApprovalRequest,
} from "@/lib/hitl-approval-client";
import { messageFromUnknown } from "@/lib/error-message";

interface ApprovalsInboxPanelProps {
  memberJwt: string;
}

export function ApprovalsInboxPanel({ memberJwt }: ApprovalsInboxPanelProps) {
  const [pending, setPending] = useState<HitlApprovalRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!memberJwt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const list = await fetchPendingApprovalsForMe(memberJwt);
      setPending(list);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load approvals inbox"));
    } finally {
      setLoading(false);
    }
  }, [memberJwt]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 15_000);
    return () => clearInterval(t);
  }, [load]);

  async function decide(id: string, decision: "approve" | "reject") {
    if (!memberJwt.trim()) return;
    if (pending.length >= 2 && confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setBusy(id);
    setError(null);
    try {
      await postApprovalDecision(memberJwt, id, decision);
      setConfirmId(null);
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Decision failed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Section
      title="Approvals inbox"
      description="Cross-room pending HITL tool approvals assigned to you."
    >
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
          {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Inbox className="mr-1.5 h-3.5 w-3.5" />}
          Refresh
        </Button>
        {pending.length ? (
          <Badge variant="secondary">{pending.length} pending</Badge>
        ) : null}
      </div>

      {pending.length === 0 && !loading ? (
        <p className="mt-3 text-sm text-muted-foreground">No pending approvals for your user id.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {pending.map((item) => (
            <li key={item.id} className="rounded-lg border bg-background p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <code className="text-xs font-semibold">{item.toolName}</code>
                <Link href={`/rooms?room=${encodeURIComponent(item.roomId)}`} className="text-xs text-brand underline">
                  room {item.roomId}
                </Link>
                {item.startedAt ? (
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(item.startedAt).toLocaleString()}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Request id: {item.id}</p>

              {confirmId === item.id && pending.length >= 2 ? (
                <div className="mt-2 rounded-md border border-amber-300/60 bg-amber-50/80 p-2 text-xs text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
                  You are about to <strong>{busy === item.id ? "…" : "approve or reject"}</strong>{" "}
                  <strong>{item.toolName}</strong> in room <strong>{item.roomId}</strong>.
                  {pending.length > 1 ? (
                    <> You have {pending.length - 1} other pending approval(s). Confirm this specific request.</>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={busy === item.id}
                  onClick={() => void decide(item.id, "approve")}
                >
                  {busy === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  Approve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === item.id}
                  onClick={() => void decide(item.id, "reject")}
                >
                  <X className="h-3 w-3" /> Reject
                </Button>
                {confirmId === item.id ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmId(null)}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </Section>
  );
}
