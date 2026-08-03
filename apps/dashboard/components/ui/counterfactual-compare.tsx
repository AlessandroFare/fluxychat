"use client";

import { normalizeAgentRun, type AgentRunDisplay, type AgentToolCallDisplay } from "@/lib/agent-run-display";
import { cn } from "@/lib/utils";

interface CounterfactualCompareProps {
  original: AgentRunDisplay;
  alternative: AgentRunDisplay;
  toolCallId?: string;
  className?: string;
}

function ToolCallColumn({
  title,
  toolCall,
  badge,
}: {
  title: string;
  toolCall: AgentToolCallDisplay | undefined;
  badge?: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-md border border-border/60 bg-background/80 p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        {badge ? (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">{badge}</span>
        ) : null}
      </div>
      {toolCall ? (
        <>
          <code className="text-xs font-semibold">{toolCall.name}</code>
          <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] text-muted-foreground">
            {toolCall.arguments}
          </pre>
          {toolCall.resultPreview ? (
            <p className="mt-2 text-[10px] text-foreground">→ {toolCall.resultPreview}</p>
          ) : null}
          {toolCall.success === true ? (
            <span className="mt-1 text-[10px] text-emerald-700">ok</span>
          ) : toolCall.success === false ? (
            <span className="mt-1 text-[10px] text-red-600">failed</span>
          ) : null}
        </>
      ) : (
        <p className="text-[10px] text-muted-foreground">Tool call not found in this run.</p>
      )}
    </div>
  );
}

export function CounterfactualCompare({
  original,
  alternative,
  toolCallId,
  className,
}: CounterfactualCompareProps) {
  const origTool = original.tool_calls?.find((tc) => !toolCallId || tc.id === toolCallId)
    ?? original.tool_calls?.[0];
  const altTool = alternative.tool_calls?.find((tc) => !toolCallId || tc.id === toolCallId)
    ?? alternative.tool_calls?.[0];

  const altBadge = alternative.status === "completed" ? "alternative" : alternative.status;

  return (
    <div className={cn("space-y-2", className)} data-testid="counterfactual-compare">
      <p className="text-xs font-medium text-foreground">Counterfactual comparison</p>
      <div className="grid gap-2 md:grid-cols-2">
        <ToolCallColumn title="Original" toolCall={origTool} />
        <ToolCallColumn title="Alternative" toolCall={altTool} badge={altBadge} />
      </div>
    </div>
  );
}

export function counterfactualRunFromPayload(row: Record<string, unknown>): AgentRunDisplay {
  return normalizeAgentRun(row);
}
