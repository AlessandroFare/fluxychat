"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";

export type SceneApprovalDecision = "approved" | "rejected" | null;

interface SceneApprovalCardProps {
  toolLabel?: string;
  amountLabel?: string;
  actorLabel?: string;
  demo?: boolean;
  decision: SceneApprovalDecision;
  onDecide: (decision: "approved" | "rejected") => void;
}

export function SceneApprovalCard({
  toolLabel = "refund_order",
  amountLabel = "240 €",
  actorLabel = "You",
  demo = true,
  decision,
  onDecide,
}: SceneApprovalCardProps) {
  const [busy, setBusy] = useState(false);

  function decide(next: "approved" | "rejected") {
    setBusy(true);
    onDecide(next);
    setBusy(false);
  }

  return (
    <div
      className="rounded-xl border border-amber-300/70 bg-amber-50 p-4 text-left dark:bg-amber-950/30"
      data-testid="scene-approval-card"
    >
      {demo ? (
        <p className="text-[10px] font-medium uppercase tracking-wide text-amber-800/80">Demo scene</p>
      ) : null}
      <p className="mt-1 text-sm font-medium text-foreground">
        The agent wants to run <code className="text-xs">{toolLabel}</code> ({amountLabel}). It is
        waiting for approval.
      </p>
      {decision ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {decision === "approved" ? "Approved" : "Rejected"} by {actorLabel} at{" "}
          {new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}.
        </p>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
            onClick={() => decide("approved")}
          >
            <Check className="h-3.5 w-3.5" />
            Approve
          </button>
          <button
            type="button"
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
            onClick={() => decide("rejected")}
          >
            <X className="h-3.5 w-3.5" />
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
