"use client";

import { usePathname } from "next/navigation";
import { isMarketingRoute } from "@/lib/is-marketing-route";
import {
  HOSTED_PATHS,
  consoleEntryHref,
  isClerkClientConfigured,
} from "@/lib/hosted-product";
import Header from "./Header";
import { LandingHeader } from "../landing/landing-chrome";

/**
 * Public pages share the C pill header; landing and room pages include it in
 * their own root. Console routes keep the operator header.
 */
export default function ConditionalHeader() {
  const pathname = usePathname();

  if (pathname?.startsWith("/onboarding")) {
    return null;
  }

  if (
    pathname === "/" ||
    pathname === "/landing" ||
    pathname?.startsWith("/landing/") ||
    pathname === "/enter" ||
    pathname?.startsWith("/enter/") ||
    pathname === "/solutions" ||
    pathname?.startsWith("/solutions/")
  ) {
    return null;
  }

  if (isMarketingRoute(pathname)) {
    return (
      <LandingHeader
        startHref={isClerkClientConfigured() ? HOSTED_PATHS.signUp : HOSTED_PATHS.getStarted}
        accountHref={consoleEntryHref()}
        themeToggle
      />
    );
  }

  return <Header />;
}
