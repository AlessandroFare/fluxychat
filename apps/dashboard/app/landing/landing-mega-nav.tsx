"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { LANDING_NAV_MENUS, type LandingNavMenu } from "./landing-shared";

interface LandingMegaNavProps {
  docked?: boolean;
  linkClassName?: string;
}

function MegaMenuPanel({ menu }: { menu: LandingNavMenu }) {
  if (menu.href) {
    return (
      <Link href={menu.href} className="shrink-0 rounded-full px-2.5 py-1.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/5 hover:text-white">
        {menu.label}
      </Link>
    );
  }

  const columns = menu.columns ?? [];
  const flatLinks = menu.links ?? columns.flatMap((col) => col.links);
  const isWide = columns.length >= 2;

  return (
    <div className="group relative shrink-0">
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm font-medium text-zinc-300 transition-colors group-hover:bg-white/5 group-hover:text-white group-focus-within:bg-white/5 group-focus-within:text-white"
        aria-haspopup="true"
      >
        {menu.label}
        <ChevronDown className="size-3.5 transition-transform group-hover:-rotate-180 group-focus-within:-rotate-180" aria-hidden />
      </button>
      <div
        className={cn(
          "pointer-events-none absolute left-0 top-full z-50 pt-2 opacity-0 transition-opacity duration-150",
          "group-hover:pointer-events-auto group-hover:opacity-100",
          "group-focus-within:pointer-events-auto group-focus-within:opacity-100",
        )}
      >
        <div
          className={cn(
            "rounded-xl border border-white/10 bg-[#111111] p-4 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)]",
            isWide ? "grid min-w-[22rem] grid-cols-2 gap-6" : "min-w-[12rem]",
          )}
        >
          {columns.length > 0
            ? columns.map((column) => (
                <div key={column.heading}>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {column.heading}
                  </p>
                  <ul className="space-y-1">
                    {column.links.map((link) => (
                      <li key={link.href + link.label}>
                        <Link
                          href={link.href}
                          className="block rounded-md px-2 py-1.5 text-sm text-slate-100 transition-colors hover:bg-white/10"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            : (
              <ul className="space-y-1">
                {flatLinks.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="block rounded-md px-2 py-1.5 text-sm text-slate-100 transition-colors hover:bg-white/10"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
        </div>
      </div>
    </div>
  );
}

export function LandingMegaNav({ docked, linkClassName }: LandingMegaNavProps) {
  return (
    <nav
      className={cn(
        "hidden min-w-0 justify-center font-medium md:col-start-2 md:flex md:flex-nowrap",
        docked ? "gap-1 px-2 text-xs lg:gap-2 lg:text-sm" : "gap-2 text-sm lg:gap-3",
        linkClassName,
      )}
      aria-label="Top links"
    >
      {LANDING_NAV_MENUS.map((menu) => (
        <MegaMenuPanel key={menu.label} menu={menu} />
      ))}
    </nav>
  );
}
