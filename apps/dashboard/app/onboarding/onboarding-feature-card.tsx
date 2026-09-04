"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingFeatureCardProps {
  icon: LucideIcon;
  title: string;
  desc: string;
  href: string;
  accent: string;
  className?: string;
}

export function OnboardingFeatureCard({
  icon: Icon,
  title,
  desc,
  href,
  accent,
  className,
}: OnboardingFeatureCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group block w-full rounded-2xl bg-background p-4 text-left shadow-[var(--shadow-2)]",
        "transition-[box-shadow] duration-200 hover:shadow-[var(--shadow-3)]",
        className,
      )}
    >
      <div className="flex w-full items-start gap-4">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            accent,
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{desc}</p>
        </div>
        <ArrowRight
          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform duration-200 group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>
    </Link>
  );
}
