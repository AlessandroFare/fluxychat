"use client";

import { Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AgentRunDisplay } from "@/lib/agent-run-display";
import { runStatusLabel } from "@/lib/agent-run-display";
import { cn } from "@/lib/utils";

interface AgentRunStatusProps {
  run: AgentRunDisplay | null;
  pending?: boolean;
  /** Hide outer “Agent run” heading (e.g. inside run history list). */
  compact?: boolean;
  className?: string;
}

function statusVariant(
  status: string,
): "success" | "destructive" | "muted" {
  if (status === "completed") return "success";
  if (status === "failed") return "destructive";
  return "muted";
}

export function AgentRunStatus({ run, pending, compact, className }: AgentRunStatusProps) {
  if (!run && !pending) return null;

  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 bg-background/60 px-3 py-2.5 text-sm",
        className,
      )}
      data-testid="agent-run-status"
    >
      {!compact ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Agent run
          </span>
          {pending && !run ? (
            <Badge variant="muted">Running…</Badge>
          ) : run ? (
            <Badge variant={statusVariant(run.status)}>{runStatusLabel(run.status)}</Badge>
          ) : null}
        </div>
      ) : run ? (
        <p className="text-xs text-muted-foreground">
          Room <span className="font-mono">{run.room_id || "—"}</span>
        </p>
      ) : null}

      {pending && !run ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Waiting for the Worker to finish (mention invoke runs in the background).
        </p>
      ) : null}

      {run ? (
        <>
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">{run.id}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {run.latency_ms != null ? `${run.latency_ms}ms` : "—"}
            {run.input_tokens != null || run.output_tokens != null
              ? ` · tokens ${run.input_tokens ?? 0}/${run.output_tokens ?? 0}`
              : ""}
            {run.iterations != null ? ` · ${run.iterations} LLM pass(es)` : ""}
            {run.estimated_cost != null ? ` · ~$${run.estimated_cost.toFixed(4)}` : ""}
          </p>
          {run.error ? (
            <p className="mt-2 text-xs text-red-600" role="alert">
              {run.error}
            </p>
          ) : null}
          {run.tool_calls && run.tool_calls.length > 0 ? (
            <ul className="mt-3 space-y-2" data-testid="agent-tool-calls">
              {run.tool_calls.map((tc) => (
                <li
                  key={tc.id}
                  className="rounded-md border border-border/50 bg-muted/30 px-2.5 py-2 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Wrench className="h-3 w-3 text-muted-foreground" aria-hidden />
                    <code className="font-semibold text-foreground">{tc.name}</code>
                    {tc.success === true ? (
                      <span className="text-emerald-700">ok</span>
                    ) : tc.success === false ? (
                      <span className="text-red-600">failed</span>
                    ) : null}
                  </div>
                  <pre className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] text-muted-foreground">
                    {tc.arguments}
                  </pre>
                  {tc.resultPreview ? (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      → {tc.resultPreview}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
