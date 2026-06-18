"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Plus, Sparkles } from "lucide-react";
import { Button, EmptyState, SkeletonCard } from "@/app/components/ui";
import { formatModelRef } from "@/lib/agent-catalog";
import { cn } from "@/lib/utils";
import { useAgentsConsole } from "./agents-console-context";

const FIRST_RUN_KEY = "fluxychat.agents.firstRunDismissed.v1";

export function AgentsSidebar() {
  const pathname = usePathname();
  const { visibleAgents, loadingAgents, activeProject } = useAgentsConsole();
  const isNew = pathname === "/agents/new";

  // Area 5.2: first-run hint. If the user has agents but hasn't dismissed
  // the hint, show a small banner. Dismissed state is per-browser.
  const dismissed =
    typeof window !== "undefined" &&
    window.localStorage.getItem(FIRST_RUN_KEY) === "1";
  const showFirstRun =
    !dismissed && visibleAgents.length > 0 && !isNew;

  function dismissFirstRun() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(FIRST_RUN_KEY, "1");
    }
  }

  return (
    // <div> not <aside>: the root layout already provides <main>, and
    // nested <aside> inside <main> is a "landmark nested inside another
    // landmark" violation (axe `landmark-unique` / `region`).
    <div className="flex flex-col gap-3" aria-label="Agents sidebar">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Agents</h2>
      <Link
        href="/agents/new"
        className={cn(
          "inline-flex w-full cursor-pointer items-center justify-center rounded-md border font-medium whitespace-nowrap transition-colors",
          "h-8 px-3 text-sm gap-1.5",
          isNew
            ? "border-transparent bg-[var(--am-midnight-ink)] text-white"
            : "border-border bg-background text-foreground hover:bg-muted/60",
        )}
      >
        <Plus className="mr-2 h-4 w-4" />
        New agent
      </Link>

      {showFirstRun ? (
        <div className="relative rounded-lg border border-amber-200/70 bg-amber-50 p-3 text-xs text-amber-900">
          <Sparkles className="absolute right-2 top-2 h-3.5 w-3.5 text-amber-500" aria-hidden />
          <p className="pr-4 font-medium">Your agent is ready.</p>
          <p className="mt-0.5 pr-4 text-amber-800/80">
            Mention <code className="rounded bg-white/60 px-1">@{visibleAgents[0]?.handle || "agent"}</code> in any room to activate it.
          </p>
          <button
            type="button"
            onClick={dismissFirstRun}
            className="mt-2 text-[11px] font-medium text-amber-900/70 underline-offset-2 hover:underline"
          >
            Got it
          </button>
        </div>
      ) : null}

      {loadingAgents && visibleAgents.length === 0 ? (
        <div className="flex flex-col gap-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : null}

      {visibleAgents.length === 0 && !loadingAgents ? (
        <EmptyState
          icon={Bot}
          title="No agents"
          description={
            activeProject?.id ? "Use New agent to add one." : "Choose a project on Overview first."
          }
        />
      ) : null}

      <ul className="flex flex-col gap-1.5">
        {visibleAgents.map((agent) => {
          const isSelected =
            pathname === `/agents/${agent.id}` || pathname.startsWith(`/agents/${agent.id}/`);
          return (
            <li key={agent.id}>
              <Link
                href={`/agents/${agent.id}`}
                className={cn(
                  "block w-full rounded-xl border px-3 py-3 text-left transition-colors",
                  isSelected
                    ? "border-brand/40 bg-brand/5 ring-1 ring-brand/20"
                    : "border-border/60 bg-white/80 hover:border-border hover:bg-muted/30",
                )}
              >
                <div className="font-medium text-foreground">{agent.name}</div>
                {agent.handle ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">@{agent.handle}</p>
                ) : null}
                <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                  {agent.provider && agent.model
                    ? formatModelRef(agent.provider, agent.model)
                    : "no model"}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
