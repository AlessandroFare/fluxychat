"use client";

import { cn } from "@/lib/utils";
import type { MergeConflictRow, MergeConflictVersion } from "@/lib/merge-conflict-client";

interface MergeConflictCompareProps {
  conflict: MergeConflictRow;
  className?: string;
}

function VersionColumn({ title, version, badge }: { title: string; version: MergeConflictVersion; badge?: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-md border border-border/60 bg-background/80 p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
        {badge ? (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">{badge}</span>
        ) : null}
      </div>
      <p className="whitespace-pre-wrap break-words text-xs text-foreground">{version.content}</p>
      <p className="mt-2 text-[10px] text-muted-foreground">
        {version.originInstance} · {version.ts}
      </p>
    </div>
  );
}

export function MergeConflictCompare({ conflict, className }: MergeConflictCompareProps) {
  return (
    <div className={cn("space-y-2", className)} data-testid="merge-conflict-compare">
      <p className="text-xs font-medium text-foreground">
        Merge conflict · message {conflict.messageKey}
      </p>
      <div className="grid gap-2 md:grid-cols-2">
        <VersionColumn title="Version A" version={conflict.versionA} badge="A" />
        <VersionColumn title="Version B" version={conflict.versionB} badge="B" />
      </div>
    </div>
  );
}
