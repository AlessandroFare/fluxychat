"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Plus } from "lucide-react";
import { Button, EmptyState, SkeletonCard } from "@/app/components/ui";
import { formatModelRef } from "@/lib/agent-catalog";
import { cn } from "@/lib/utils";
import { useAgentsConsole } from "./agents-console-context";

export function AgentsSidebar() {
  const pathname = usePathname();
  const { visibleAgents, loadingAgents, activeProject } = useAgentsConsole();
  const isNew = pathname === "/agents/new";

  return (
    <aside className="flex flex-col gap-3">
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
    </aside>
  );
}
