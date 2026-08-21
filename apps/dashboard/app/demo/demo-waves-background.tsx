"use client";

import dynamic from "next/dynamic";
import { useTheme } from "@/app/components/theme-provider";

const GradientWaves = dynamic(
  () => import("~/components/GradientWaves").then((m) => ({ default: m.default })),
  { ssr: false },
);

export function DemoWavesBackground() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <GradientWaves
        className="absolute inset-0 h-full min-h-full w-full"
        horizonColor={isDark ? "#1e1e1e" : "#f7f3ea"}
        waveColor={isDark ? "#3a2a22" : "#e4d4c4"}
        crestColor={isDark ? "#ff8a47" : "#c2410c"}
        speed={0.28}
        amplitude={2.1}
        brightness={isDark ? 0.72 : 0.88}
        opacity={isDark ? 0.85 : 0.55}
        grain
        grainIntensity={0.04}
        mouseInteraction
        detail="medium"
      />
      <div
        className={
          isDark
            ? "absolute inset-0 bg-[#1e1e1e]/55"
            : "absolute inset-0 bg-[#FDFBF9]/50"
        }
      />
    </div>
  );
}
