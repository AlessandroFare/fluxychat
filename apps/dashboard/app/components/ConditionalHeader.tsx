"use client";

import { usePathname } from "next/navigation";
import { isMarketingRoute } from "@/lib/is-marketing-route";
import Header from "./Header";
import { MarketingTopNav } from "./marketing-top-nav";

/**
 * Landing, enter, pricing, and labs ship their own header (LandingShell).
 * Why/compare/guides/demo/docs/status/sign-in use MarketingTopNav.
 * Console routes use Header (auth controls).
 */
export default function ConditionalHeader() {
  const pathname = usePathname();

  if (
    pathname === "/" ||
    pathname === "/landing" ||
    pathname?.startsWith("/landing/") ||
    pathname === "/enter" ||
    pathname?.startsWith("/enter/") ||
    pathname === "/pricing" ||
    pathname?.startsWith("/pricing/") ||
    pathname === "/labs" ||
    pathname?.startsWith("/labs/")
  ) {
    return null;
  }

  if (isMarketingRoute(pathname)) {
    return <MarketingTopNav />;
  }

  return <Header />;
}
