import React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateAction =
  | { label: string; onClick: () => void; href?: never }
  | { label: string; href: string; onClick?: never };

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  className?: string;
  action?: EmptyStateAction;
  /** Dense variant for section-sized spots (inside cards, inbox sections). */
  compact?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-border bg-surface-muted text-center",
        compact ? "px-4 py-5" : "py-12",
        className,
      )}
    >
      {Icon ? (
        <Icon className={cn("text-muted-foreground", compact ? "mb-2 h-5 w-5" : "mb-3 h-8 w-8")} aria-hidden />
      ) : null}
      <h3 className={cn("font-semibold text-foreground", compact ? "text-sm" : "mb-1 text-base")}>{title}</h3>
      <p
        className={cn(
          "text-muted-foreground",
          compact ? "mt-0.5 text-xs" : "max-w-xs text-sm",
          action ? "mb-4" : null,
        )}
      >
        {description}
      </p>
      {action ? (
        "href" in action && action.href ? (
          <Link
            href={action.href}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {action.label}
          </button>
        )
      ) : null}
    </div>
  );
}
