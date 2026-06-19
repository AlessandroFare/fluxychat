"use client";

import { usePathname } from "next/navigation";
import { isMarketingRoute } from "@/lib/is-marketing-route";
import Header from "./Header";
import { MarketingTopNav } from "./marketing-top-nav";

/**
 * Landing/why/enter ship their own header.
 * Compare/guides/demo/docs/status/sign-in use MarketingTopNav.
 * Console routes use Header (auth controls).
 */
export default function ConditionalHeader() {
  const pathname = usePathname();

  if (
    pathname === "/landing" ||
    pathname?.startsWith("/landing/") ||
    pathname === "/why" ||
    pathname?.startsWith("/why/") ||
    pathname === "/enter" ||
    pathname?.startsWith("/enter/")
  ) {
    return null;
  }

  if (isMarketingRoute(pathname)) {
    return <MarketingTopNav />;
  }

  return <Header />;
}
