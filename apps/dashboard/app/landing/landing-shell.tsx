"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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
import { attachLandingPointer } from "./landing-pointer";

/** Sticky marketing nav — dark cinematic shell; page body stays as server `children`. */
export function LandingShell({ children }: { children: ReactNode }) {
  const [navDocked, setNavDocked] = useState(false);
  const mobileNav = useTopNavMobileMenu();
  const pathname = usePathname();
  const pointerWashRef = useRef<HTMLDivElement>(null);
  const dockSentinelRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => attachLandingPointer(pointerWashRef.current), []);

  useEffect(() => {
    const sentinel = dockSentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => {
      const next = !entry.isIntersecting;
      setNavDocked((prev) => (prev === next ? prev : next));
    });
    io.observe(sentinel);
    return () => io.disconnect();
  }, []);

  return (
    <div
      id="fc-marketing-root"
      className="relative flex min-h-dvh flex-col bg-[var(--mkt-bg)] text-[var(--mkt-text)] antialiased"
    >
      <div
        ref={dockSentinelRef}
        className="pointer-events-none absolute left-0 top-0 h-[100px] w-px"
        aria-hidden
      />
      <div className="mkt-scroll-progress" aria-hidden />
      <HeroSignalField />
      <div
        ref={pointerWashRef}
        className="mkt-pointer-wash pointer-events-none fixed inset-0 z-[1]"
        aria-hidden
      />
      <header
        className={cn(
          "fixed z-50 isolate transition-[top,left,right,width,transform,border-radius,box-shadow,padding,border-width,background-color] duration-300 ease-out",
          navDocked
            ? cn(
                "left-1/2 right-auto top-3 w-[min(calc(100vw-1.5rem),72rem)] -translate-x-1/2 border border-[var(--mkt-border)] bg-[var(--mkt-nav-docked-bg)] py-2 pl-3 pr-2 shadow-[var(--shadow-2)] sm:top-5 sm:pl-4 sm:pr-3 dark:backdrop-blur-xl",
                mobileNav.open ? "rounded-2xl" : "rounded-full",
              )
            : "left-0 right-0 top-0 border-b border-[var(--mkt-border)] bg-[var(--mkt-nav-bg)] py-0 dark:backdrop-blur-md",
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
