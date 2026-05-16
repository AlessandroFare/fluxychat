"use client";

import { useId, useLayoutEffect, useRef } from "react";
import gsap from "gsap";

/**
 * T-connector from the section title into three cards (block layout, no overlap).
 * viewBox 0 0 1000 88 — stems align with 3× grid column centers (≈16.67%, 50%, 83.33%).
 */
export function TeamsStartFlow() {
  const uid = useId().replace(/:/g, "");
  const gradId = `teams-flow-grad-${uid}`;
  const glowId = `teams-flow-dot-glow-${uid}`;

  const pathRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);

  const pathD = "M 500 4 L 500 32 L 167 32 L 167 84 M 500 32 L 500 84 M 500 32 L 833 32 L 833 84";

  useLayoutEffect(() => {
    const path = pathRef.current;
    const dot = dotRef.current;
    if (!path || !dot) return;

    const length = path.getTotalLength?.() ?? 500;
    gsap.set(dot, { opacity: 0 });

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      gsap.set(dot, { opacity: 1 });
      return;
    }

    let raf = 0;
    let progress = 0;
    const speed = 0.0016;

    function animateDot() {
      progress += speed;
      if (progress > 1) progress = 0;
      const pt = path!.getPointAtLength(progress * length);
      dot!.setAttribute("cx", String(pt.x));
      dot!.setAttribute("cy", String(pt.y));
      raf = requestAnimationFrame(animateDot);
    }

    gsap.set(dot, { opacity: 1 });
    raf = requestAnimationFrame(animateDot);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="pointer-events-none relative mx-auto mb-1 w-full max-w-6xl select-none"
      style={{ height: "clamp(56px, 8vw, 88px)" }}
      aria-hidden
    >
      <svg className="h-full w-full overflow-visible" viewBox="0 0 1000 88" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,115,94,0.75)" />
            <stop offset="48%" stopColor="rgba(255,115,94,1)" />
            <stop offset="100%" stopColor="rgba(91,76,219,0.8)" />
          </linearGradient>
          <filter id={glowId} x="-300%" y="-300%" width="700%" height="700%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path
          d={pathD}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.25"
        />

        <path
          ref={pathRef}
          d={pathD}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.5"
        />

        <circle ref={dotRef} cx="500" cy="4" r="4.5" fill="#ff725e" filter={`url(#${glowId})`} opacity="0" />
      </svg>
    </div>
  );
}
