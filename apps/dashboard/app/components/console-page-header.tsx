"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { resolveConsoleNavContext } from "@/lib/console-command-items";
import { HOSTED_PATHS } from "@/lib/hosted-product";

export function ConsolePageHeader({
  title,
  description,
  actions,
}: {
  title?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  const navContext = resolveConsoleNavContext(pathname);
  const pageTitle = title ?? navContext?.itemLabel ?? "Console";

  return (
    <header className="mb-6 border-b border-black/[0.06] pb-5">
      {/*
        Breadcrumb rendered as a plain <ol> (not a <nav>) so it does not
        become a nested navigation landmark inside the root layout's
        <main>. axe `landmark-no-duplicate` / nested-nav rules.
      */}
      <ol className="mb-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{pageTitle}</h1>
          {description ? (
            <div className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</div>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </header>
  );
}
