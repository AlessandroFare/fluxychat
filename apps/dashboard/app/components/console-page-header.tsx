"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { resolveConsoleNavContext } from "@/lib/console-command-items";
import { HOSTED_PATHS } from "@/lib/hosted-product";

export function ConsolePageHeader({
  title,
  description,
  actions,
  icon: Icon,
}: {
  title?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: LucideIcon;
}) {
  const pathname = usePathname();
  const navContext = resolveConsoleNavContext(pathname);
  const pageTitle = title ?? navContext?.itemLabel ?? "Console";

  return (
    <header className="mb-7 border-b border-border pb-5">
      {/*
        Breadcrumb rendered as a plain <ol> (not a <nav>) so it does not
        become a nested navigation landmark inside the root layout's
        <main>. axe `landmark-no-duplicate` / nested-nav rules.
        Skipped on the console root, where it would read "Console › Console".
      */}
      {pathname === HOSTED_PATHS.console ? null : (
        <ol className="mb-3 flex flex-wrap items-center gap-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          <li>
            <Link href={HOSTED_PATHS.console} className="hover:text-foreground">
              Console
            </Link>
          </li>
          {navContext ? (
            <>
              <li className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3 opacity-50" aria-hidden />
                <span>{navContext.groupLabel}</span>
              </li>
              <li className="flex items-center gap-1 font-medium text-foreground">
                <ChevronRight className="h-3 w-3 opacity-50" aria-hidden />
                <span aria-current="page">{pageTitle}</span>
              </li>
            </>
          ) : pathname !== "/" ? (
            <li className="flex items-center gap-1 font-medium text-foreground">
              <ChevronRight className="h-3 w-3 opacity-50" aria-hidden />
              <span aria-current="page">{pageTitle}</span>
            </li>
          ) : null}
        </ol>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading flex items-center gap-2.5 text-[clamp(2rem,3vw,2.75rem)] font-normal leading-[1.02] tracking-[-0.035em] text-foreground">
            {Icon ? <Icon className="h-6 w-6 shrink-0 text-muted-foreground" aria-hidden /> : null}
            {pageTitle}
          </h1>
          {description ? (
            <div className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
