"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FluxychatLogotype } from "@/components/FluxychatLogo";
import { cn } from "@/lib/utils";
import { CONSOLE_NAV_MAIN, CONSOLE_NAV_TOOLS } from "./console-nav";

function NavLink({ href, label, icon: Icon }: (typeof CONSOLE_NAV_MAIN)[number]) {
  const pathname = usePathname();
  const isActive =
    href === "/" ? pathname === "/" : pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900",
      )}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
      {label}
    </Link>
  );
}

export function ConsoleSidebar() {
  return (
    <aside className="hidden w-56 shrink-0 border-r border-black/[0.06] bg-white/70 backdrop-blur-md lg:flex lg:flex-col">
      <div className="flex h-14 items-center border-b border-black/[0.06] px-4">
        <Link href="/" className="text-slate-900" aria-label="Fluxychat console home">
          <FluxychatLogotype size={24} />
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4" aria-label="Console">
        <div>
          <p className="mb-2 px-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Operate
          </p>
          <ul className="space-y-0.5">
            {CONSOLE_NAV_MAIN.map((item) => (
              <li key={item.href}>
                <NavLink {...item} />
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 px-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Tools
          </p>
          <ul className="space-y-0.5">
            {CONSOLE_NAV_TOOLS.map((item) => (
              <li key={item.href}>
                <NavLink {...item} />
              </li>
            ))}
          </ul>
        </div>
      </nav>
      <div className="border-t border-black/[0.06] p-3">
        <Link
          href="/landing"
          className="block rounded-lg px-2.5 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
        >
          ← Product &amp; pricing
        </Link>
      </div>
    </aside>
  );
}
