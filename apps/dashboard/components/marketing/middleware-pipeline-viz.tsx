"use client";

/**
 * MiddlewarePipelineViz — edge pipeline with animated packet (React Bits / TeamsStartFlow pattern).
 * MIT inspiration: flowing connectors + spotlight nodes.
 */
import { useId, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "publish", label: "Client publish", tone: "neutral" as const },
  { id: "moderate", label: "moderate()", tone: "indigo" as const },
  { id: "validate", label: "validate()", tone: "cyan" as const },
  { id: "enrich", label: "enrich()", tone: "emerald" as const },
  { id: "deliver", label: "Subscribers", tone: "neutral" as const },
] as const;

const TONE_CLASS: Record<(typeof STEPS)[number]["tone"], string> = {
  neutral: "border-white/10 bg-white/[0.06] text-slate-200",
  indigo: "border-indigo-400/35 bg-indigo-500/15 text-indigo-100",
  cyan: "border-cyan-400/35 bg-cyan-500/15 text-cyan-100",
  emerald: "border-emerald-400/35 bg-emerald-500/15 text-emerald-100",
};

const PATH_D = "M 48 72 H 952";

export function MiddlewarePipelineViz({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const gradId = `mw-pipe-grad-${uid}`;
  const glowId = `mw-pipe-glow-${uid}`;

  const pathRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useLayoutEffect(() => {
    const path = pathRef.current;
    const dot = dotRef.current;
    if (!path || !dot) return;

    const length = path.getTotalLength();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      gsap.set(dot, { opacity: 1, attr: { cx: 48, cy: 72 } });
      return;
    }

    let raf = 0;
    let progress = 0;
    const speed = 0.0011;

    function tick() {
      progress += speed;
      if (progress > 1) progress = 0;
      const pt = path!.getPointAtLength(progress * length);
      dot!.setAttribute("cx", String(pt.x));
      dot!.setAttribute("cy", String(pt.y));
      const idx = Math.min(STEPS.length - 1, Math.floor(progress * STEPS.length));
      setActiveIndex(idx);
      raf = requestAnimationFrame(tick);
    }

    gsap.fromTo(dot, { opacity: 0 }, { opacity: 1, duration: 0.4 });
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d1117] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_20px_50px_-24px_rgba(0,0,0,0.45)] sm:p-6",
        className,
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">edge middleware</span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-emerald-400/90">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
          live
        </span>
      </div>

      <div className="relative" style={{ height: "clamp(148px, 22vw, 180px)" }}>
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          viewBox="0 0 1000 144"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(255,115,94,0.35)" />
              <stop offset="50%" stopColor="rgba(255,115,94,0.95)" />
              <stop offset="100%" stopColor="rgba(139,92,246,0.75)" />
            </linearGradient>
            <filter id={glowId} x="-200%" y="-200%" width="500%" height="500%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path
            ref={pathRef}
            d={PATH_D}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="2"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            opacity={0.85}
          />
          <circle
            ref={dotRef}
            r="5"
            fill="#ff9b7a"
            filter={`url(#${glowId})`}
            opacity={0}
          />
        </svg>

        <div className="relative z-10 grid h-full grid-cols-5 items-end gap-1 pb-1 sm:gap-2">
          {STEPS.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                "mx-auto w-full max-w-[9.5rem] rounded-lg border px-2 py-2 text-center font-mono text-[10px] transition duration-300 sm:text-[11px]",
                TONE_CLASS[step.tone],
                activeIndex === index &&
                  "scale-[1.03] border-primary/50 shadow-[0_0_20px_-4px_rgba(255,115,94,0.55)] ring-1 ring-primary/30",
              )}
            >
              {step.label}
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 font-mono text-[10px] leading-relaxed text-zinc-500 sm:text-xs">
        <span className="text-zinc-400">//</span> hooks run on your Worker before delivery — policy stays on the edge.
      </p>
    </div>
  );
}
