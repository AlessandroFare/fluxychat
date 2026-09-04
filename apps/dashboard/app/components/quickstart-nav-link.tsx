"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { useQuickstartHref } from "@/lib/use-quickstart-href";
import { consoleNavIconClass, consoleNavLinkClass } from "./console-nav";

interface QuickstartNavLinkProps {
  label: string;
  icon: LucideIcon;
}

/** Quickstart nav: incomplete → wizard; complete → `?review=1`. */
export function QuickstartNavLink({ label, icon: Icon }: QuickstartNavLinkProps) {
  const pathname = usePathname();
  const href = useQuickstartHref();
  const isActive = pathname === "/onboarding" || pathname?.startsWith("/onboarding/");

  return (
    <Link href={href} className={consoleNavLinkClass(isActive)}>
      <Icon className={consoleNavIconClass(isActive)} aria-hidden />
      {label}
    </Link>
  );
}
