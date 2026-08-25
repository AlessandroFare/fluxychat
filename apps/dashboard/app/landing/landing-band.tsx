"use client";

import { useEffect, useState, type ReactNode } from "react";
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
  /** Skip view-timeline fade so nested sticky / horizontal scroll can pin to the viewport. */
  reveal?: boolean;
}

export function LandingBand({ tone, children, className, reveal = true }: LandingBandProps) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    function sync() {
      setReduceMotion(mq.matches);
    }
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <div
      className={cn(
        "relative",
        tone === "light" && "mkt-band-light",
        tone === "dark" && "mkt-band-dark",
        tone === "glass" && "mkt-band-glass",
        className,
      )}
    >
      {tone === "light" ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <Grainient
            className="z-0"
            color1="#faf8f5"
            color2="#faf8f5"
            color3="#fdeee6"
            grainAnimated={!reduceMotion}
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
        </div>
      ) : null}
      <div className={cn("relative z-10", reveal && "mkt-reveal")}>{children}</div>
    </div>
  );
}
