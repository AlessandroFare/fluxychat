"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONSOLE_NAV_MAIN, CONSOLE_NAV_TOOLS } from "./console-nav";

const MOBILE_LINKS = [...CONSOLE_NAV_MAIN, ...CONSOLE_NAV_TOOLS];

export function ConsoleMobileNav() {
  const pathname = usePathname();

  return (
    <div className="border-b border-black/[0.06] bg-white/90 px-3 py-2 lg:hidden">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-2 py-2 text-sm font-medium text-slate-700 marker:hidden [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <Menu className="h-4 w-4" aria-hidden />
            Sections
          </span>
          <span className="text-xs text-slate-400 group-open:hidden">Menu</span>
          <span className="hidden text-xs text-slate-400 group-open:inline">Close</span>
        </summary>
        <nav className="mt-2 grid grid-cols-2 gap-1 pb-1 sm:grid-cols-3" aria-label="Console mobile">
          {MOBILE_LINKS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-2 py-2 text-center text-xs font-medium",
                  isActive ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-slate-50",
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
