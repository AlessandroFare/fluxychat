"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useDashboardSession } from "@/app/components/dashboard-session";
import {
  fetchPendingApprovalsForRoom,
  postApprovalDecision,
  type HitlApprovalRequest,
} from "@/lib/hitl-approval-client";
import { messageFromUnknown } from "@/lib/error-message";

interface ToolApprovalPanelProps {
  roomId: string;
  enabled?: boolean;
}

export function ToolApprovalPanel({ roomId, enabled = true }: ToolApprovalPanelProps) {
  const { adminJwt, memberJwt } = useDashboardSession();
  const token = (adminJwt || memberJwt).trim();
  const [pending, setPending] = useState<HitlApprovalRequest[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const disabledRef = useRef(false);

  const load = useCallback(async () => {
    if (!enabled || disabledRef.current || !token || !roomId) return;
    try {
      const list = await fetchPendingApprovalsForRoom(token, roomId);
      setPending(list);
    } catch {
      setPending([]);
    }
  }, [enabled, token, roomId]);

  useEffect(() => {
    if (!enabled) {
      setPending([]);
      return;
    }
    disabledRef.current = false;
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [enabled, load]);

  async function decide(id: string, decision: "approve" | "reject") {
    if (!token) return;
    if (pending.length >= 2 && confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setBusy(id);
    try {
      await postApprovalDecision(token, id, decision);
      setConfirmId(null);
      await load();
    } catch (err) {
      console.error(messageFromUnknown(err, "Approval decision failed"));
    } finally {
      setBusy(null);
    }
  }

  if (!enabled || pending.length === 0) return null;

  return (
    <div className="mx-4 mb-2 space-y-2 rounded-lg border border-amber-300/60 bg-amber-50/80 p-3 dark:bg-amber-950/20">
      <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">Tool approvals pending</p>
      {pending.map((a) => (
        <div key={a.id} className="rounded-md border bg-background/80 p-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <code className="font-semibold">{a.toolName}</code>
            <span className="text-muted-foreground">#{a.id.slice(0, 8)}</span>
          </div>
          {confirmId === a.id && pending.length >= 2 ? (
            <p className="mt-2 text-[11px] text-amber-900 dark:text-amber-100">
              Confirm: approve/reject <strong>{a.toolName}</strong> (request {a.id.slice(0, 8)}…)?
              {pending.length > 1 ? ` ${pending.length - 1} other pending.` : ""}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="default" disabled={busy === a.id} onClick={() => void decide(a.id, "approve")}>
              {busy === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Approve
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={busy === a.id} onClick={() => void decide(a.id, "reject")}>
              <X className="h-3 w-3" /> Reject
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
