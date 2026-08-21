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
      className="inline-flex max-w-[14rem] items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/30"
      title="Active project — open Projects to switch"
    >
      <FolderKanban className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
      <span className="truncate font-medium">
        {activeProject?.name || activeProject?.id || "No project"}
      </span>
    </Link>
  );
}
