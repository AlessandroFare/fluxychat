"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Lock } from "lucide-react";
import { useState } from "react";
import { FluxychatLogotype } from "@/components/FluxychatLogo";
import { cn } from "@/lib/utils";
import { HOSTED_PATHS } from "@/lib/hosted-product";
import { useQuickstartNavLock } from "@/lib/use-quickstart-nav-lock";
import {
  CONSOLE_NAV_GROUPS,
  isConsoleNavItemActive,
  type ConsoleNavItem,
  type ConsoleNavSubgroup,
} from "./console-nav";
import { QuickstartNavLink } from "./quickstart-nav-link";
import { InboxNavLink } from "./inbox-nav-link";
import { CommandPaletteTrigger } from "./console-command-palette";

function NavLink({
  href,
  label,
  icon: Icon,
  locked,
}: ConsoleNavItem & { locked?: boolean }) {
  const pathname = usePathname();
  const isActive = isConsoleNavItemActive(href, pathname);

  if (locked) {
    return (
      <span
        className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-400 opacity-50"
        title="Complete onboarding first"
        aria-disabled="true"
      >
        <Icon className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
        {label}
        <Lock className="ml-auto h-3 w-3 opacity-60" aria-hidden />
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
      {label}
    </Link>
  );
}

function NavItemRow({ item, locked }: { item: ConsoleNavItem; locked?: boolean }) {
  if (item.href === "/onboarding") {
    return <QuickstartNavLink label={item.label} icon={item.icon} />;
  }
  if (item.href === "/inbox") {
    return locked ? <NavLink {...item} locked /> : <InboxNavLink />;
  }
  return <NavLink {...item} locked={locked} />;
}

function NavSubgroup({ subgroup, navLocked }: { subgroup: ConsoleNavSubgroup; navLocked?: boolean }) {
  const pathname = usePathname();
  const hasActiveChild = subgroup.items.some((item) => isConsoleNavItemActive(item.href, pathname));
  const [open, setOpen] = useState(hasActiveChild);

  if (subgroup.items.length === 0) return null;

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="mb-1 flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted"
        aria-expanded={open}
      >
        {subgroup.label}
        <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <ul className="ml-1 flex flex-col gap-0.5 border-l border-slate-200/80 pl-2">
          {subgroup.items.map((item) => (
            <li key={item.href}>
              <NavItemRow item={item} locked={navLocked && item.href !== "/onboarding"} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function CollapsibleNavGroup({
  label,
  items,
  subgroups,
  defaultOpen = false,
  navLocked,
}: {
  label: string;
  items?: ConsoleNavItem[];
  subgroups?: ConsoleNavSubgroup[];
  defaultOpen?: boolean;
  navLocked?: boolean;
}) {
  const pathname = usePathname();
  const flatItems = [
    ...(items ?? []),
    ...(subgroups ?? []).flatMap((sg) => sg.items),
  ];
  const hasActiveChild = flatItems.some((item) => isConsoleNavItemActive(item.href, pathname));
  const [open, setOpen] = useState(defaultOpen || hasActiveChild);

  if (flatItems.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="mb-2 flex w-full items-center justify-between rounded-lg px-2.5 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground hover:bg-muted"
        aria-expanded={open}
      >
        {label}
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div className="flex flex-col gap-0.5">
          {subgroups?.map((sg) => (
            <NavSubgroup key={sg.label} subgroup={sg} navLocked={navLocked} />
          ))}
          {items?.length ? (
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => (
                <li key={item.href}>
                  <NavItemRow item={item} locked={navLocked && item.href !== "/onboarding"} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ConsoleSidebar() {
  const { locked: navLocked } = useQuickstartNavLock();

  return (
    <aside className="hidden w-56 shrink-0 border-r border-border bg-background lg:flex lg:flex-col">
      <div className="flex h-14 items-center border-b border-border px-4">
        <Link href={HOSTED_PATHS.console} className="text-foreground" aria-label="Fluxychat console home">
          <FluxychatLogotype size={24} />
        </Link>
      </div>
      {navLocked ? (
        <div className="mx-3 mt-3 rounded-lg border border-amber-200/80 bg-amber-50/90 px-2.5 py-2 text-[10px] leading-snug text-amber-900">
          Finish <strong>Quickstart</strong> to unlock the rest of the console.
        </div>
      ) : null}
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4" aria-label="Console">
        {CONSOLE_NAV_GROUPS.map((group) => (
          <CollapsibleNavGroup
            key={group.label}
            label={group.label}
            items={group.items}
            subgroups={group.subgroups}
            defaultOpen={group.defaultOpen}
            navLocked={navLocked}
          />
        ))}
      </nav>
      <div className="space-y-2 border-t border-border p-3">
        <CommandPaletteTrigger />
        {navLocked ? (
          <span
            className="block cursor-not-allowed rounded-lg px-2.5 py-2 text-xs font-medium text-slate-400 opacity-50"
            aria-disabled="true"
          >
            Settings
          </span>
        ) : (
          <Link
            href="/settings"
            className="block rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Settings
          </Link>
        )}
        <Link
          href={HOSTED_PATHS.landing}
          className="block rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          ← Product &amp; pricing
        </Link>
      </div>
    </aside>
  );
}
