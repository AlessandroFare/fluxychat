"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Banner, EmptyState, Section } from "./ui";
import { messageFromUnknown } from "@/lib/error-message";
import { opsToolCalls, type OpsToolCallRow } from "@/lib/ops-client";
import { formatDateTime } from "@/lib/format-datetime";

/**
 * Tool-invocation log: every gateway call — ran, waiting on approval, denied —
 * with the hash that links it to the frozen payload.
 */
export function OpsToolActivity({ token }: { token: string }) {
  const [items, setItems] = useState<OpsToolCallRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = token.trim();
    if (!auth) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await opsToolCalls(auth);
        if (cancelled) return;
        setItems(data.items || []);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(messageFromUnknown(err, "Could not load tool activity"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const rows = items || [];
  return (
    <Section title="Tool activity" description="Every governed call: ran, waiting on approval or input, or denied.">
      {error ? <Banner variant="error">{error}</Banner> : null}
      {items === null && !error ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading
        </p>
      ) : null}
      {items !== null && rows.length === 0 && !error ? (
        <EmptyState title="No tool calls yet" description="Calls land here as soon as a run reaches a tool step." />
      ) : null}
      {rows.length ? (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">
                  {row.result?.tool || "tool"}
                  <span className={`ml-2 rounded-full border px-2 py-0.5 text-xs ${badgeClass(row.eventType)}`}>
                    {badgeLabel(row.eventType)}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  {row.runId ? `run ${row.runId.slice(0, 8)}` : "run"}
                  {row.actor ? ` · ${row.actor}` : ""}
                  {row.createdAt ? ` · ${formatDateTime(row.createdAt)}` : ""}
                </p>
              </div>
              {row.result?.error ? <span className="text-xs text-destructive">{row.result.error}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  );
}

function badgeLabel(eventType: string) {
  if (eventType === "ops.tool.denied") return "denied";
  if (eventType === "ops.tool.failed") return "failed";
  if (eventType === "ops.tool.approval_required") return "waiting approval";
  if (eventType === "ops.tool.input_required") return "waiting input";
  if (eventType === "ops.tool.input_answered") return "input answered";
  return "ran";
}

function badgeClass(eventType: string) {
  if (eventType === "ops.tool.denied" || eventType === "ops.tool.failed") return "border-destructive/40 text-destructive";
  if (eventType === "ops.tool.approval_required" || eventType === "ops.tool.input_required") return "border-amber-500/40 text-amber-600";
  return "border-border text-muted-foreground";
}
