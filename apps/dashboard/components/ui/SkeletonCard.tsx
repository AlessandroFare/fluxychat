import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-border bg-surface-card p-4 dark:border-[#1f2937] dark:bg-[#020617]">
      <Skeleton className="mb-2 h-4 w-1/3" />
      <Skeleton className="mb-1.5 h-3 w-1/2" />
      <Skeleton className="mb-4 h-3 w-2/5" />
      <Skeleton className="h-7 w-24" />
    </div>
  );
}
