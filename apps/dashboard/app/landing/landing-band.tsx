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
        <>
          <Grainient
            className="z-0"
            color1="#faf8f5"
            color2="#faf8f5"
            color3="#fdeee6"
            grainAnimated
            grainAmount={0.08}
            grainScale={1.55}
            timeSpeed={0.1}
            warpSpeed={0.55}
            saturation={0.4}
            contrast={1}
            gamma={1}
            zoom={0.88}
            centerX={0}
            centerY={-0.06}
            blendAngle={18}
            blendSoftness={0.55}
          />
          <div
            className="pointer-events-none absolute inset-0 z-[1]"
            style={{
              background:
                "radial-gradient(ellipse 82% 70% at 50% 40%, rgba(250,248,245,0.94) 0%, rgba(250,248,245,0.72) 42%, rgba(250,248,245,0.28) 68%, transparent 86%)",
            }}
            aria-hidden
          />
        </>
      ) : null}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
