"use client";

import { AlertCircle, CheckCircle2, Wrench } from "lucide-react";
import type { AgentToolThreadEvent } from "@/lib/agent-tool-thread";
import { cn } from "@/lib/utils";

interface AgentToolThreadCardProps {
  event: AgentToolThreadEvent;
  className?: string;
}

const KIND_LABEL = {
  tool_call: "Tool call",
  tool_result: "Tool result",
  tool_error: "Tool error",
} as const;

export function AgentToolThreadCard({ event, className }: AgentToolThreadCardProps) {
  const isError = event.kind === "tool_error";
  const isResult = event.kind === "tool_result";
  const hasDetails = Boolean(event.arguments || event.resultPreview || event.error);

  return (
    <details
      className={cn(
        "group mx-6 rounded-md border text-xs",
        isError
          ? "border-red-200/80 bg-red-50/80"
          : isResult
            ? "border-emerald-200/60 bg-emerald-50/50"
            : "border-border/60 bg-muted/40",
        className,
      )}
      data-testid={`agent-tool-${event.kind}`}
      open={!hasDetails ? true : undefined}
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-2.5 py-2 [&::-webkit-details-marker]:hidden">
        {isError ? (
          <AlertCircle className="h-3 w-3 shrink-0 text-red-600" aria-hidden />
        ) : isResult ? (
          <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-700" aria-hidden />
        ) : (
          <Wrench className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <span className="font-medium text-muted-foreground">{KIND_LABEL[event.kind]}</span>
        <code className="font-semibold text-foreground">{event.name}</code>
        {hasDetails ? (
          <span className="ml-auto text-[10px] text-muted-foreground group-open:hidden">Show</span>
        ) : null}
      </summary>
      {event.arguments ? (
        <pre className="mx-2.5 mb-2 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded border border-border/50 bg-background/60 p-2 font-mono text-[10px] text-muted-foreground">
          {event.arguments}
        </pre>
      ) : null}
      {event.resultPreview ? (
        <p className="mx-2.5 mb-2 font-mono text-[10px] text-muted-foreground">→ {event.resultPreview}</p>
      ) : null}
      {event.error ? (
        <p className="mx-2.5 mb-2 text-[10px] text-red-700" role="alert">
          {event.error}
        </p>
      ) : null}
    </details>
  );
}
