"use client";

/**
 * SpotlightCard — cursor-following radial highlight.
 * From React Bits (MIT): https://reactbits.dev/components/spotlight-card
 * Upstream: https://github.com/DavidHDev/react-bits
 */
import React, { useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Position {
  x: number;
  y: number;
}

export interface SpotlightCardProps extends React.PropsWithChildren {
  className?: string;
  spotlightColor?: string;
}

export function SpotlightCard({
  children,
  className,
  spotlightColor = "rgba(255, 117, 94, 0.2)",
}: SpotlightCardProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!divRef.current || isFocused) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
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
      className={cn("relative overflow-hidden rounded-2xl border border-border bg-card/85 backdrop-blur-sm", className)}
    >
      <div
        className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-500 ease-out"
        style={{
          opacity,
          background: `radial-gradient(circle 420px at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 72%)`,
        }}
        aria-hidden
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
