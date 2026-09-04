"use client";

/**
 * SpotlightCard — cursor-following radial highlight.
 * From React Bits (MIT): https://reactbits.dev/components/spotlight-card
 * Upstream: https://github.com/DavidHDev/react-bits
 */
import React, { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface SpotlightCardProps extends React.PropsWithChildren {
  className?: string;
  spotlightColor?: string;
}

export function SpotlightCard({
  children,
  className,
  spotlightColor = "rgba(194, 65, 12, 0.2)",
}: SpotlightCardProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const washRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [opacity, setOpacity] = useState(0);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!divRef.current || !washRef.current || isFocused) return;
    const rect = divRef.current.getBoundingClientRect();
    washRef.current.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
    washRef.current.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
  }

  function handleFocus() {
    setIsFocused(true);
    setOpacity(0.55);
  }

  function handleBlur() {
    setIsFocused(false);
    setOpacity(0);
  }

  function handleMouseEnter() {
    setOpacity(0.55);
  }

  function handleMouseLeave() {
    setOpacity(0);
  }

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn("relative overflow-hidden rounded-2xl bg-card/85 shadow-[var(--shadow-2)] backdrop-blur-sm", className)}
    >
      <div
        ref={washRef}
        className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-500 ease-out"
        style={{
          opacity,
          background: `radial-gradient(circle 420px at var(--spot-x, 50%) var(--spot-y, 40%), ${spotlightColor}, transparent 72%)`,
        }}
        aria-hidden
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
