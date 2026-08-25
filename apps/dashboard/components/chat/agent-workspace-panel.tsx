"use client";

import {
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Code2,
  Database,
  FileText,
  Globe,
  Loader2,
  Monitor,
  Wrench,
  XCircle,
} from "lucide-react";
import type { AgentWorkspaceStep, AgentWorkspaceStepCategory } from "@fluxy-chat/sdk";
import { agentWorkspaceStepsToUiParts } from "@fluxy-chat/sdk";
import { cn } from "@/lib/utils";
import { Badge } from "~/components/ui/badge";
import { AgentUiRenderer } from "~/components/chat/agent-ui-renderer";
import type { AgentRunDisplay } from "@/lib/agent-run-display";
import { runStatusLabel } from "@/lib/agent-run-display";

interface AgentWorkspacePanelProps {
  steps: AgentWorkspaceStep[];
  run?: AgentRunDisplay | null;
  isLive?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

const CATEGORY_ICON: Record<AgentWorkspaceStepCategory, typeof Wrench> = {
  thinking: BrainCircuit,
  search: Globe,
  research: BrainCircuit,
  code: Code2,
  browser: Monitor,
  file: FileText,
  data: Database,
  generic: Wrench,
};

function StepStatusIcon({ status }: { status: AgentWorkspaceStep["status"] }) {
  if (status === "running") {
    return <Loader2 className="size-3.5 animate-spin text-brand" aria-hidden />;
  }
  if (status === "completed") {
    return <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden />;
  }
  if (status === "failed") {
    return <XCircle className="size-3.5 text-red-600" aria-hidden />;
  }
  return <Circle className="size-3.5 text-muted-foreground" aria-hidden />;
}

function WorkspaceStepRow({
  step,
  isLast,
}: {
  step: AgentWorkspaceStep;
  isLast: boolean;
}) {
  const CategoryIcon = CATEGORY_ICON[step.category] ?? Wrench;
  const children = step.children ?? [];
  return (
    <li className="relative flex gap-3 pb-3 last:pb-1" data-testid="agent-workspace-step">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full border",
            step.status === "running"
              ? "border-brand/40 bg-brand/10"
              : step.status === "failed"
                ? "border-red-200 bg-red-50"
                : step.status === "completed"
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-border bg-muted/40",
          )}
        >
          <CategoryIcon className="size-3.5 text-muted-foreground" aria-hidden />
        </div>
        {!isLast ? <span className="mt-1 w-px flex-1 bg-border/80" aria-hidden /> : null}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <StepStatusIcon status={step.status} />
          <span className="text-sm font-medium text-foreground">{step.label}</span>
          <code className="rounded bg-muted/60 px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
            {step.toolName}
          </code>
        </div>
        {step.argsPreview ? (
          <pre className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap break-all rounded border border-border/40 bg-background/80 p-2 font-mono text-[10px] text-muted-foreground">
            {step.argsPreview}
          </pre>
        ) : null}
        {step.resultPreview ? (
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">→ {step.resultPreview}</p>
        ) : null}
        {step.error ? (
          <p className="mt-1 text-[10px] text-red-700" role="alert">
            {step.error}
          </p>
        ) : null}
        {children.length > 0 ? (
          <ol className="mt-2 border-l border-border/70 pl-3" data-testid="agent-workspace-nested">
            {children.map((child, index) => (
              <WorkspaceStepRow key={child.id} step={child} isLast={index === children.length - 1} />
            ))}
          </ol>
        ) : null}
      </div>
    </li>
  );
}

export function AgentWorkspacePanel({
  steps,
  run,
  isLive = false,
  open = true,
  onOpenChange,
  className,
}: AgentWorkspacePanelProps) {
  if (steps.length === 0 && !isLive) return null;

  const uiParts = agentWorkspaceStepsToUiParts(steps);
  const Icon = Bot;

  return (
    <section
      className={cn(
        "rounded-lg border border-brand/20 bg-gradient-to-b from-brand/5 to-background shadow-sm",
        className,
      )}
      data-testid="agent-workspace-panel"
      aria-live="polite"
      aria-label="Agent workspace"
    >
      <header className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
        <Icon className="size-4 text-brand" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
              Agent workspace
            </h3>
            {isLive ? (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                </span>
                Live
              </Badge>
            ) : run?.status ? (
              <Badge variant="muted" className="text-[10px]">
                {runStatusLabel(run.status)}
              </Badge>
            ) : null}
          </div>
          {run?.id ? (
            <p className="truncate font-mono text-[10px] text-muted-foreground">{run.id}</p>
          ) : (
            <p className="text-[10px] text-muted-foreground">
              Watch what the agent is doing — visible to everyone in this room.
            </p>
          )}
        </div>
        {onOpenChange ? (
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            onClick={() => onOpenChange(!open)}
            aria-expanded={open}
            aria-label={open ? "Collapse agent workspace" : "Expand agent workspace"}
          >
            {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        ) : null}
      </header>

      {open ? (
        <ol className="max-h-72 space-y-0 overflow-y-auto px-3 py-2">
          {steps.length === 0 ? (
            <li className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Waiting for agent activity…
            </li>
          ) : (
            steps.map((step, index) => (
              <WorkspaceStepRow
                key={step.id}
                step={step}
                isLast={index === steps.length - 1}
              />
            ))
          )}
        </ol>
      ) : null}

      {open && uiParts.length > 0 ? (
        <div className="border-t border-border/50 px-3 py-2">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Tool output (AG-UI)
          </p>
          <AgentUiRenderer parts={uiParts} className="max-h-48 overflow-y-auto" />
        </div>
      ) : null}

      {open && run ? (
        <footer className="border-t border-border/50 px-3 py-2 text-[10px] text-muted-foreground">
          {run.latency_ms != null ? `${run.latency_ms}ms` : null}
          {run.input_tokens != null || run.output_tokens != null
            ? ` · tokens ${run.input_tokens ?? 0}/${run.output_tokens ?? 0}`
            : null}
          {run.iterations != null ? ` · ${run.iterations} pass(es)` : null}
        </footer>
      ) : null}
    </section>
  );
}
