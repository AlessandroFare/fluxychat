"use client";

import { Loader2, MessageSquareQuote, Scale } from "lucide-react";
import type { AgentDebateStep } from "@fluxy-chat/sdk";
import { isDebateSessionLive } from "@fluxy-chat/sdk";
import { cn } from "@/lib/utils";
import { Badge } from "~/components/ui/badge";

interface DebateThreadPanelProps {
  steps: AgentDebateStep[];
  sessionId?: string | null;
  className?: string;
}

function StepBubble({ step }: { step: AgentDebateStep }) {
  const isModerator = step.participantRole === "moderator";
  return (
    <li
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        isModerator ? "border-violet-300/60 bg-violet-500/5" : "border-border/80 bg-background/80",
      )}
      data-testid="debate-step"
    >
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Badge variant={isModerator ? "default" : "secondary"} className="text-[10px]">
          {step.roleName}
        </Badge>
        {!isModerator ? (
          <span className="text-[10px] text-muted-foreground">round {step.round}</span>
        ) : null}
        {step.status === "running" ? (
          <Loader2 className="size-3 animate-spin text-brand" aria-label="In progress" />
        ) : null}
        {step.status === "failed" ? (
          <Badge variant="destructive" className="text-[10px]">
            failed
          </Badge>
        ) : null}
      </div>
      {step.status === "running" && !step.content ? (
        <p className="text-xs text-muted-foreground">Thinking…</p>
      ) : (
        <p className="whitespace-pre-wrap text-foreground">{step.content || "—"}</p>
      )}
    </li>
  );
}

export function DebateThreadPanel({ steps, sessionId, className }: DebateThreadPanelProps) {
  if (!steps.length) return null;

  const live = isDebateSessionLive(steps);
  const perspectives = steps.filter((s) => s.participantRole === "debate");
  const moderator = steps.filter((s) => s.participantRole === "moderator");

  return (
    <section
      className={cn(
        "rounded-lg border border-violet-500/25 bg-gradient-to-b from-violet-500/5 to-background shadow-sm",
        className,
      )}
      data-testid="debate-thread-panel"
      aria-live="polite"
      aria-label="Multi-agent debate"
    >
      <header className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
        <Scale className="size-4 text-violet-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
              Agent debate
            </h3>
            {live ? (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-violet-500 opacity-60" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-violet-500" />
                </span>
                Live
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">
                Complete
              </Badge>
            )}
          </div>
          {sessionId ? (
            <p className="truncate font-mono text-[10px] text-muted-foreground">{sessionId}</p>
          ) : (
            <p className="text-[10px] text-muted-foreground">
              Multiple perspectives before the moderator synthesis.
            </p>
          )}
        </div>
        <MessageSquareQuote className="size-4 text-muted-foreground" aria-hidden />
      </header>

      <ol className="max-h-64 space-y-2 overflow-y-auto px-3 py-2">
        {perspectives.map((step) => (
          <StepBubble key={step.id} step={step} />
        ))}
        {moderator.map((step) => (
          <StepBubble key={step.id} step={step} />
        ))}
      </ol>
    </section>
  );
}
