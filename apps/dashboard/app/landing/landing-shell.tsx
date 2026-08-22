"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LandingNavAuthCta } from "../components/landing-auth-cta";
import {
  TopNavMobileMenuButton,
  TopNavMobileMenuPanel,
  useTopNavMobileMenu,
} from "../components/top-nav-mobile-menu";
import { FluxychatLogotype } from "@/components/FluxychatLogo";
import { HOSTED_PATHS } from "@/lib/hosted-product";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "~/components/ui/ThemeToggle";
import { LANDING_MOBILE_MENU_ID, LANDING_NAV_LINKS } from "./landing-shared";
import { LandingMegaNav } from "./landing-mega-nav";
import { HeroSignalField } from "~/components/marketing/hero-signal-field";

/** Sticky marketing nav — dark cinematic shell; page body stays as server `children`. */
export function LandingShell({ children }: { children: ReactNode }) {
  const [navDocked, setNavDocked] = useState(false);
  const mobileNav = useTopNavMobileMenu();
  const pathname = usePathname();

  useEffect(() => {
    mobileNav.close();
  }, [pathname, mobileNav.close]);

  useEffect(() => {
    function onHashChange() {
      mobileNav.close();
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [mobileNav.close]);

  useEffect(() => {
    function onScroll() {
      const next = window.scrollY > 100;
      setNavDocked((prev) => (prev === next ? prev : next));
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      id="fc-marketing-root"
      className="relative flex min-h-dvh flex-col bg-[var(--mkt-bg)] text-[var(--mkt-text)] antialiased"
    >
      <HeroSignalField />
      <header
        className={cn(
          "fixed z-50 transition-[top,left,right,width,transform,border-radius,box-shadow,padding,border-width,background-color] duration-300 ease-out",
          navDocked
            ? cn(
                "left-1/2 right-auto top-3 w-[min(calc(100vw-1.5rem),72rem)] -translate-x-1/2 border border-[var(--mkt-border)] py-2 pl-3 pr-2 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.35)] sm:top-5 sm:pl-4 sm:pr-3",
                mobileNav.open
                  ? "rounded-2xl bg-[var(--mkt-nav-docked-bg)] backdrop-blur-xl"
                  : "rounded-full bg-[var(--mkt-nav-docked-bg)] backdrop-blur-xl",
              )
            : "left-0 right-0 top-0 border-b border-[var(--mkt-border)] bg-[var(--mkt-nav-bg)] py-0 backdrop-blur-md",
        )}
      >
        <div
          className={cn(
            "mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:gap-3 md:grid-cols-[auto_1fr_auto]",
            navDocked ? "px-2 sm:px-3" : "h-14 px-4 sm:h-16 sm:px-6",
          )}
        >
          <div className="flex min-w-0 items-center overflow-hidden md:col-start-1">
            <Link
              href={HOSTED_PATHS.landing}
              className={cn("min-w-0 truncate text-[var(--mkt-text)]", navDocked ? "scale-[0.92] sm:scale-100" : "")}
              aria-label="Fluxychat"
            >
              <FluxychatLogotype size={navDocked ? 22 : 24} className="sm:!text-[inherit]" />
            </Link>
          </div>
          <LandingMegaNav docked={navDocked} />
          <div className="relative z-20 col-start-2 flex shrink-0 items-center justify-end gap-1 sm:gap-2 md:col-start-3">
            <ThemeToggle className="shrink-0 border-[var(--mkt-border)] text-[var(--mkt-text)]" />
            <LandingNavAuthCta navDocked={navDocked} />
            <TopNavMobileMenuButton
              open={mobileNav.open}
              onToggle={mobileNav.toggle}
              menuId={LANDING_MOBILE_MENU_ID}
              className="border-[var(--mkt-border)] text-[var(--mkt-text)]"
            />
          </div>
        </div>
        <TopNavMobileMenuPanel
          open={mobileNav.open}
          onClose={mobileNav.close}
          links={LANDING_NAV_LINKS}
          menuId={LANDING_MOBILE_MENU_ID}
          linkClass="text-sm font-medium text-[var(--mkt-text)] hover:bg-[var(--mkt-surface-2)]"
          panelClassName="border-[var(--mkt-border)] bg-[var(--mkt-bg-elevated)] text-[var(--mkt-text)]"
        />
      </header>
      <div className="relative z-10 flex flex-1 flex-col">{children}</div>
    </div>
  );
}
