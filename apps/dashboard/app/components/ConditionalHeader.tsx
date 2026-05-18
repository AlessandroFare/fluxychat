"use client";

import { usePathname } from "next/navigation";
import Header from "./Header";

/**
 * Marketing routes ship their own sticky header inside the page so we avoid
 * stacking two global navbars (e.g. old home mini-nav + layout Header).
 */
export default function ConditionalHeader() {
  const pathname = usePathname();
  if (
    pathname === "/landing" ||
    pathname?.startsWith("/landing/") ||
    pathname === "/why" ||
    pathname?.startsWith("/why/") ||
    pathname === "/enter" ||
    pathname?.startsWith("/enter/") ||
    pathname === "/sign-in" ||
    pathname?.startsWith("/sign-in/") ||
    pathname === "/sign-up" ||
    pathname?.startsWith("/sign-up/") ||
    pathname === "/slides" ||
    pathname?.startsWith("/slides/")
  ) {
    return null;
  }
  return <Header />;
}
