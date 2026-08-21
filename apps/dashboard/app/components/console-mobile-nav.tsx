"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Lock, Menu, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { HOSTED_PATHS } from "@/lib/hosted-product";
import { useQuickstartHref } from "@/lib/use-quickstart-href";
import { useQuickstartNavLock } from "@/lib/use-quickstart-nav-lock";
import {
  flattenConsoleNavItems,
  isConsoleNavItemActive,
} from "./console-nav";
import { useCommandPalette } from "./console-command-palette";

export function ConsoleMobileNav() {
  const pathname = usePathname();
  const quickstartHref = useQuickstartHref();
  const { locked: navLocked } = useQuickstartNavLock();
  const { open: openCommandPalette } = useCommandPalette();

  return (
    <div className="border-b border-border bg-background px-3 py-2 lg:hidden">
      <div className="mb-2 flex items-center gap-2">
        <Link
          href={HOSTED_PATHS.landing}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-2 text-xs font-medium text-foreground hover:bg-muted"
        >
          <Home className="h-3.5 w-3.5" aria-hidden />
          Home
        </Link>
        <button
          type="button"
          onClick={openCommandPalette}
          className="inline-flex flex-1 items-center gap-2 rounded-lg border border-border bg-muted/80 px-2.5 py-2 text-xs text-muted-foreground"
          data-testid="command-palette-trigger-mobile"
        >
          <Search className="h-3.5 w-3.5" aria-hidden />
          Search console…
        </button>
      </div>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-2 py-2 text-sm font-medium text-slate-700 marker:hidden [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <Menu className="h-4 w-4" aria-hidden />
            Sections
          </span>
          <span className="text-xs text-slate-600 group-open:hidden">Menu</span>
          <span className="hidden text-xs text-slate-600 group-open:inline">Close</span>
        </summary>
        {navLocked ? (
          <p className="mt-2 rounded-lg border border-amber-200/80 bg-amber-50/90 px-2.5 py-2 text-[10px] leading-snug text-amber-900">
            Finish <strong>Quickstart</strong> to unlock the rest of the console.
          </p>
        ) : null}
        <nav className="mt-2 grid grid-cols-2 gap-1 pb-1 sm:grid-cols-3" aria-label="Console mobile">
          {flattenConsoleNavItems().map((item) => {
            const isActive = isConsoleNavItemActive(item.href, pathname);
            const isLocked = navLocked && item.href !== "/onboarding";
            const href = item.href === "/onboarding" ? quickstartHref : item.href;

            if (isLocked) {
              return (
                <span
                  key={item.href}
                  className="inline-flex cursor-not-allowed items-center justify-center gap-1 rounded-lg px-2 py-2 text-center text-xs font-medium text-slate-400 opacity-50"
                  title="Complete onboarding first"
                  aria-disabled="true"
                >
                  {item.label}
                  <Lock className="size-3 shrink-0 opacity-60" aria-hidden />
                </span>
              );
            }

            return (
              <Link
                key={item.href}
                href={href}
                className={cn(
                  "rounded-lg px-2 py-2 text-center text-xs font-medium",
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </details>
    </div>
  );
}
