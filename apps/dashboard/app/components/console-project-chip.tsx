"use client";

import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { useDashboardSession } from "./dashboard-session";

export function ConsoleProjectChip() {
  const { hasHydrated, activeProject } = useDashboardSession();
  if (!hasHydrated) return null;

  return (
    <Link
      href="/projects"
      className="inline-flex max-w-[14rem] items-center gap-1.5 rounded-sm border border-border bg-card px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground hover:border-[var(--ring)]"
      title="Active project — open Projects to switch"
    >
      <FolderKanban className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
      <span className="truncate font-medium">
        {activeProject?.name || activeProject?.id || "No project"}
      </span>
    </Link>
  );
}
