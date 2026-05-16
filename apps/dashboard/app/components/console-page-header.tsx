"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { CONSOLE_NAV_MAIN, CONSOLE_NAV_TOOLS } from "./console-nav";

const ALL_NAV = [...CONSOLE_NAV_MAIN, ...CONSOLE_NAV_TOOLS];

function titleForPath(pathname: string): string {
  if (pathname === "/") return "Overview";
  const match = ALL_NAV.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return match?.label ?? "Console";
}

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
  const pageTitle = title ?? titleForPath(pathname ?? "/");

  return (
    <header className="mb-6 border-b border-black/[0.06] pb-5">
      <nav className="mb-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-foreground">
          Console
        </Link>
        {pathname !== "/" ? (
          <>
            <ChevronRight className="h-3 w-3 opacity-50" aria-hidden />
            <span className="font-medium text-foreground">{pageTitle}</span>
          </>
        ) : null}
      </nav>
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
