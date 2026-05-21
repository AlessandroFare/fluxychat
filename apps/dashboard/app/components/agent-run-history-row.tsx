"use client";

import { Badge } from "@/components/ui/badge";
import { normalizeAgentRun, runStatusLabel } from "@/lib/agent-run-display";
import { formatDateTime } from "@/lib/format-datetime";
import { AgentRunStatus } from "./agent-run-status";
import { cn } from "@/lib/utils";

function statusVariant(
  status: string,
): "success" | "destructive" | "muted" {
  if (status === "completed") return "success";
  if (status === "failed") return "destructive";
  return "muted";
}

export interface AgentRunHistoryRowProps {
  run: Record<string, unknown>;
  className?: string;
}

export function AgentRunHistoryRow({ run: raw, className }: AgentRunHistoryRowProps) {
  const row = normalizeAgentRun(raw);
  const createdAt =
    raw.created_at != null ? String(raw.created_at) : row.created_at;

  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-sm",
        className,
      )}
      data-testid="agent-run-history-row"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <Badge variant={statusVariant(row.status)}>{runStatusLabel(row.status)}</Badge>
        {createdAt ? (
          <span className="text-xs text-muted-foreground">{formatDateTime(createdAt)}</span>
        ) : null}
      </div>
      <AgentRunStatus run={row} compact className="border-0 bg-transparent p-0 shadow-none" />
    </div>
  );
}
