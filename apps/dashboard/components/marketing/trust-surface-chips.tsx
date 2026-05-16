"use client";

/**
 * TrustSurfaceChips — staggered capability chips (Animated List–lite).
 * From React Bits (MIT): https://reactbits.dev/components/animated-list
 */
import { useEffect, useRef } from "react";
import { Bell, Bot, Cloud, MessageSquare, Webhook } from "lucide-react";
import gsap from "gsap";
import { cn } from "@/lib/utils";

const CHIPS = [
  { icon: MessageSquare, label: "In-app messages" },
  { icon: Bot, label: "Agent events" },
  { icon: Bell, label: "Room notifications" },
  { icon: Webhook, label: "Signed webhooks" },
  { icon: Cloud, label: "Your Cloudflare account" },
] as const;

interface TrustSurfaceChipsProps {
  className?: string;
}

export function TrustSurfaceChips({ className }: TrustSurfaceChipsProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const items = root.querySelectorAll("[data-trust-chip]");
    if (items.length === 0) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    gsap.fromTo(
      items,
      { opacity: 0, y: 10 },
      {
        opacity: 1,
        y: 0,
        duration: 0.45,
        stagger: 0.07,
        ease: "power2.out",
        delay: 0.15,
      },
    );
  }, []);

  return (
    <div
      ref={rootRef}
      className={cn("flex flex-wrap items-center justify-center gap-2 sm:gap-2.5", className)}
      role="list"
      aria-label="Platform capabilities"
    >
      {CHIPS.map(({ icon: Icon, label }) => (
        <span
          key={label}
          data-trust-chip
          role="listitem"
          className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-[var(--shadow-subtle-2)] backdrop-blur-sm"
        >
          <Icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          {label}
        </span>
      ))}
    </div>
  );
}
