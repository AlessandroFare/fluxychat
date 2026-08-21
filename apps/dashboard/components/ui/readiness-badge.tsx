import Link from "next/link";
import { cn } from "@/lib/utils";
import { readinessBadgeClass, type ReadinessDisplayEntry } from "@/lib/readiness-display";

export function ReadinessBadge({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        readinessBadgeClass(label),
        className,
      )}
    >
      {label}
    </span>
  );
}

export function ReadinessLinkRow({
  entry,
  highlight = false,
}: {
  entry: ReadinessDisplayEntry;
  highlight?: boolean;
}) {
  return (
    <Link
      href={entry.href}
      className={cn(
        "am-focus flex items-center justify-between rounded-xl border px-4 py-3 transition",
        highlight ? "border-primary/30 bg-primary/10" : "border-border bg-card hover:border-border",
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{entry.label}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{entry.description}</span>
      </span>
      <ReadinessBadge label={entry.readinessLabel} className="ml-3 shrink-0" />
    </Link>
  );
}
