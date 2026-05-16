"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { useQuickstartHref } from "@/lib/use-quickstart-href";
import { cn } from "@/lib/utils";

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
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900",
      )}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
      {label}
    </Link>
  );
}
