"use client";

import Link from "next/link";
import { FluxychatLogotype } from "@/components/FluxychatLogo";
import { HOSTED_PATHS } from "@/lib/hosted-product";
import { HeaderAuth } from "./header-auth";
import {
  TOP_NAV_LINK_CLASS,
  TopNavMobileMenuButton,
  TopNavMobileMenuPanel,
  useTopNavMobileMenu,
  type TopNavLink,
} from "./top-nav-mobile-menu";

const LINKS: readonly TopNavLink[] = [
  { href: HOSTED_PATHS.landing, label: "Product" },
  { href: HOSTED_PATHS.compare, label: "Compare" },
  { href: HOSTED_PATHS.guides, label: "Guides" },
  { href: "/demo", label: "Demo" },
  { href: HOSTED_PATHS.getStarted, label: "Get started" },
  { href: HOSTED_PATHS.docs, label: "Docs" },
];

const MENU_ID = "marketing-mobile-menu";

export function MarketingTopNav() {
  const mobile = useTopNavMobileMenu();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-black/[0.06] bg-white/90 shadow-[var(--shadow-subtle-2)] backdrop-blur-md supports-[backdrop-filter]:bg-white/85">
      <div className="mx-auto max-w-6xl">
        <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href={HOSTED_PATHS.landing}
            className="shrink-0 text-slate-900 transition-opacity hover:opacity-80"
            aria-label="Fluxychat home"
          >
            <FluxychatLogotype size={28} />
          </Link>

          <nav className="hidden items-center gap-5 md:flex" aria-label="Top links">
            {LINKS.map((item) => (
              <Link key={item.href} href={item.href} className={TOP_NAV_LINK_CLASS}>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <HeaderAuth />
            <TopNavMobileMenuButton
              open={mobile.open}
              onToggle={mobile.toggle}
              menuId={MENU_ID}
            />
          </div>
        </div>
        <TopNavMobileMenuPanel
          open={mobile.open}
          onClose={mobile.close}
          links={LINKS}
          menuId={MENU_ID}
        />
      </div>
    </header>
  );
}
