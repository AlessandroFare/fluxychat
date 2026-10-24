"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Banner, Section } from "./ui";
import { messageFromUnknown } from "@/lib/error-message";
import { opsOversight, type OpsOversight } from "@/lib/ops-client";

/**
 * Oversight health: are human approvals real reviews or rubber stamps?
 * Decision latency, fast-approval share, quorum participation and tool
 * denials for the last 30 days. The same numbers ride along in the project
 * evidence export for auditors.
 */
export function OpsOversightSection({ token, days = 30 }: { token: string; days?: number }) {
  const [data, setData] = useState<OpsOversight | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = token.trim();
    if (!auth) return;
    let cancelled = false;
    (async () => {
      try {
        const next = await opsOversight(auth, days);
        if (cancelled) return;
        setData(next);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(messageFromUnknown(err, "Could not load oversight metrics"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, days]);

  const fastSeconds = data?.fastSeconds ?? 10;
  const fast = data?.fastShare == null ? "—" : `${Math.round(data.fastShare * 100)}% (${data.fastDecisions})`;
  return (
    <Section
      title="Oversight health"
      description={`Approvals over the last ${days} days. A decision under ${fastSeconds}s counts as fast; the evidence export carries the same numbers.`}
    >
      {error ? <Banner variant="error">{error}</Banner> : null}
      {!data && !error && token.trim() ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading
        </p>
      ) : null}
      {data ? (
        <>
          {data.rubberStamp ? (
            <Banner variant="error">
              Most decisions land under {data.fastSeconds}s — review quality, not speed, is what this control needs.
            </Banner>
          ) : null}
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <Metric label="Decisions" value={`${data.decided} decided · ${data.pending} pending`} />
            <Metric
              label="Median decision"
              value={data.medianDecisionSeconds == null ? "—" : `${Math.round(data.medianDecisionSeconds)}s`}
            />
            <Metric label={`Under ${data.fastSeconds}s`} value={fast} />
            <Metric label="Quorum met" value={data.quorumRequested ? `${data.quorumMet}/${data.quorumRequested}` : "—"} />
            <Metric label="Denied" value={`${data.denied}/${data.decided}`} />
            <Metric label="Tool denials" value={String(data.toolDenials)} />
          </dl>
          <p className="text-xs text-muted-foreground">
            {data.distinctApprovers} approver(s) decided in the window. Requested: {data.requested}.
          </p>
        </>
      ) : null}
    </Section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
