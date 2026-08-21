"use client";

/**
 * PillarsBento — Magic Bento–style border glow on pillar cards.
 * From React Bits (MIT): https://reactbits.dev/components/magic-bento
 */
import { useCallback, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PillarBentoItem {
  icon: LucideIcon;
  title: string;
  body: string;
  label: string;
}

interface PillarsBentoProps {
  items: readonly PillarBentoItem[];
  className?: string;
}

function PillarBentoCard({ icon: Icon, title, body, label }: PillarBentoItem) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    el.style.setProperty("--glow-x", `${x}%`);
    el.style.setProperty("--glow-y", `${y}%`);
    el.style.setProperty("--glow-intensity", "1");
  }, []);

  const handleLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--glow-intensity", "0");
  }, []);

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={cn(
        "fluxy-pillar-bento fluxy-pillar-bento--glow relative flex min-h-[220px] flex-col justify-between rounded-2xl border border-white/15 bg-zinc-950/80 p-6 text-white shadow-none",
      )}
    >
      <div className="relative z-10">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div
            className="flex size-10 items-center justify-center rounded-xl bg-white/10"
            aria-hidden
          >
            <Icon className="size-5 text-white" />
          </div>
          <span className="text-[10px] font-semibold uppercase text-zinc-400">
            {label}
          </span>
        </div>
        <h3 className="font-heading text-base font-semibold text-white">{title}</h3>
        <p className="mt-2 text-pretty text-sm leading-relaxed text-zinc-400">{body}</p>
      </div>
    </div>
  );
}

export function PillarsBento({ items, className }: PillarsBentoProps) {
  return (
    <div className={cn("grid gap-6 md:grid-cols-3", className)}>
      {items.map((item) => (
        <PillarBentoCard key={item.title} {...item} />
      ))}
    </div>
  );
}

