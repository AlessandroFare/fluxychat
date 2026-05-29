"use client";

import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TopNavLink {
  href: string;
  label: string;
}

export const TOP_NAV_LINK_CLASS =
  "text-sm font-medium text-slate-600 transition-colors hover:text-slate-900";

export function useTopNavMobileMenu() {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((prev) => !prev), []);
  const close = useCallback(() => setOpen(false), []);
  return { open, toggle, close };
}

interface TopNavMobileMenuButtonProps {
  open: boolean;
  onToggle: () => void;
  menuId: string;
  className?: string;
}

export function TopNavMobileMenuButton({
  open,
  onToggle,
  menuId,
  className,
}: TopNavMobileMenuButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black/[0.08] text-slate-700 md:hidden",
        className,
      )}
      aria-expanded={open}
      aria-controls={menuId}
      onClick={onToggle}
    >
      <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
      {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
    </button>
  );
}

interface TopNavMobileMenuPanelProps {
  open: boolean;
  onClose: () => void;
  links: readonly TopNavLink[];
  menuId: string;
  linkClass?: string;
  panelClassName?: string;
}

export function TopNavMobileMenuPanel({
  open,
  onClose,
  links,
  menuId,
  linkClass = TOP_NAV_LINK_CLASS,
  panelClassName,
}: TopNavMobileMenuPanelProps) {
  if (!open) return null;

  return (
    <nav
      id={menuId}
      className={cn(
        "border-t border-black/[0.06] bg-white px-4 py-3 md:hidden",
        panelClassName,
      )}
      aria-label="Mobile links"
    >
      <ul className="flex flex-col gap-1">
        {links.map((item) => (
          <li key={`${item.href}-${item.label}`}>
            <Link
              href={item.href}
              className={cn(linkClass, "block rounded-lg px-3 py-2.5")}
              onClick={onClose}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

interface TopNavMobileMenuProps {
  links: readonly TopNavLink[];
  trailing?: ReactNode;
  menuId?: string;
  linkClass?: string;
  panelClassName?: string;
}

/** Hamburger + dropdown; use inside a single header row (e.g. MarketingTopNav). */
export function TopNavMobileMenu({
  links,
  trailing,
  menuId = "top-nav-mobile-menu",
  linkClass,
  panelClassName,
}: TopNavMobileMenuProps) {
  const { open, toggle, close } = useTopNavMobileMenu();

  return (
    <>
      <div className="flex items-center gap-2">
        {trailing}
        <TopNavMobileMenuButton open={open} onToggle={toggle} menuId={menuId} />
      </div>
      <TopNavMobileMenuPanel
        open={open}
        onClose={close}
        links={links}
        menuId={menuId}
        linkClass={linkClass}
        panelClassName={panelClassName}
      />
    </>
  );
}
