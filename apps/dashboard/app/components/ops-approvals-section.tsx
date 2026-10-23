"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Banner, Button, EmptyState, Section } from "./ui";
import { messageFromUnknown } from "@/lib/error-message";
import { opsDecideApproval, opsListApprovals, type OpsApprovalRow } from "@/lib/ops-client";

/**
 * Pending run approvals: the frozen write payload waits here until an admin
 * approves it. Publisher approvals (stepId "publish") belong to /ops.
 */
export function OpsApprovalsSection({ token }: { token: string }) {
  const [items, setItems] = useState<OpsApprovalRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loadKey, setLoadKey] = useState(0);

  useEffect(() => {
    const auth = token.trim();
    if (!auth) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await opsListApprovals(auth);
        if (cancelled) return;
        setItems((data.items || []).filter((item) => item.stepId !== "publish"));
        setLoadError(null);
      } catch (err) {
        if (!cancelled) setLoadError(messageFromUnknown(err, "Could not load pending approvals"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, loadKey]);

  async function decide(item: OpsApprovalRow, decision: "approve" | "deny") {
    setBusy(item.id);
    setActionError(null);
    setNotice(null);
    try {
      await opsDecideApproval(token.trim(), item.id, decision, item.payloadHash);
      setNotice(
        decision === "approve"
          ? "Approved. The frozen payload resumes the run."
          : "Denied. The run stops on this step."
      );
    } catch (err) {
      setActionError(messageFromUnknown(err, "Decision failed"));
    } finally {
      // Reload on failure too: another admin may have decided first, or the run
      // was cancelled, so the row is stale either way.
      setLoadKey((key) => key + 1);
      setBusy(null);
    }
  }

  const error = actionError || loadError;

  return (
    <Section
      title="Approvals waiting"
      description="Writes stay blocked until an admin approves the exact payload. The same request also reaches the run room, your inbox and email."
    >
      {error ? <Banner variant="error">{error}</Banner> : null}
      {notice ? <Banner variant="info">{notice}</Banner> : null}
      {!token.trim() ? (
        <p className="text-sm text-muted-foreground">Sign in with a project token to see approvals.</p>
      ) : items === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading
        </p>
      ) : items.length === 0 ? (
        <EmptyState
          title="Nothing to approve"
          description="Approvals appear here when a run reaches a write step."
        />
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{item.payload?.tool || item.stepId}</p>
                <p className="text-muted-foreground">
                  run {item.runId?.slice(0, 8)} · {item.decisions?.length || 0} of {item.required || 1} approvals
                  {item.payloadHash ? ` · payload ${item.payloadHash.slice(0, 10)}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => void decide(item, "approve")}
                >
                  {busy === item.id ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="mr-1 h-3 w-3" />
                  )}
                  Approve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => void decide(item, "deny")}
                >
                  <X className="mr-1 h-3 w-3" />
                  Deny
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
