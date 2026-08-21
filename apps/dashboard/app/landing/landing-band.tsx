"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

const Grainient = dynamic(
  () => import("~/components/marketing/grainient").then((m) => ({ default: m.Grainient })),
  { ssr: false },
);

interface LandingBandProps {
  tone: "dark" | "light" | "glass";
  children: ReactNode;
  className?: string;
}

export function LandingBand({ tone, children, className }: LandingBandProps) {
  return (
    <div
      className={cn(
        "relative",
        tone === "light" && "mkt-band-light overflow-hidden",
        tone === "dark" && "mkt-band-dark",
        tone === "glass" && "mkt-band-glass",
        className,
      )}
    >
      {tone === "light" ? (
        <Grainient
          className="pointer-events-none absolute inset-0 z-0 opacity-70"
          color1="#f3efe8"
          color2="#e8dcd0"
          color3="#dccfc0"
          grainAnimated
          grainAmount={0.14}
          timeSpeed={0.035}
          warpSpeed={0.28}
        />
      ) : null}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
