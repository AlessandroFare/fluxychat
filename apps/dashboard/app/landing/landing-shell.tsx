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
import { LANDING_MOBILE_MENU_ID, LANDING_NAV_LINKS } from "./landing-shared";
import { LandingMegaNav } from "./landing-mega-nav";

/** Sticky marketing nav — client island; page body is composed as server `children`. */
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
    <div id="fc-marketing-root" className="flex min-h-screen flex-col bg-background text-foreground">
      <header
        className={cn(
          "fixed z-50 transition-[top,left,right,width,transform,border-radius,box-shadow,padding,border-width] duration-300 ease-out",
          mobileNav.open && "overflow-hidden",
          navDocked
            ? cn(
                "left-1/2 right-auto top-3 w-[min(calc(100vw-1.5rem),72rem)] -translate-x-1/2 border border-black/[0.06] py-2 pl-3 pr-2 shadow-[0_12px_40px_-8px_rgba(17,17,17,0.16)] sm:top-5 sm:pl-4 sm:pr-3",
                mobileNav.open
                  ? "rounded-2xl bg-white backdrop-blur-xl"
                  : "rounded-full bg-white/90 backdrop-blur-xl",
              )
            : "left-0 right-0 top-0 border-b border-black/[0.06] bg-white/90 py-0 backdrop-blur-md",
        )}
      >
        <div
          className={cn(
            "mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:gap-3 md:grid-cols-[auto_1fr_auto]",
            navDocked ? "px-2 sm:px-3" : "h-14 px-4 sm:h-16 sm:px-6",
          )}
        >
          <div className="flex min-w-0 items-center md:col-start-1">
            <Link
              href={HOSTED_PATHS.landing}
              className={cn("text-slate-900", navDocked ? "scale-[0.92] sm:scale-100" : "")}
              aria-label="Fluxychat"
            >
              <FluxychatLogotype size={navDocked ? 26 : 30} />
            </Link>
          </div>
          <LandingMegaNav docked={navDocked} />
          <div className="col-start-2 flex shrink-0 items-center justify-end gap-1.5 sm:gap-2 md:col-start-3">
            <LandingNavAuthCta navDocked={navDocked} />
            <TopNavMobileMenuButton
              open={mobileNav.open}
              onToggle={mobileNav.toggle}
              menuId={LANDING_MOBILE_MENU_ID}
            />
          </div>
        </div>
        <TopNavMobileMenuPanel
          open={mobileNav.open}
          onClose={mobileNav.close}
          links={LANDING_NAV_LINKS}
          menuId={LANDING_MOBILE_MENU_ID}
          panelClassName={cn(
            navDocked && "border-black/[0.06] bg-white",
            !navDocked && "bg-white",
          )}
        />
      </header>
      {children}
    </div>
  );
}

