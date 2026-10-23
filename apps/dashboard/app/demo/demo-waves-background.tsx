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
        horizonColor={isDark ? "#101210" : "#e8e8e4"}
        waveColor={isDark ? "#1d211d" : "#d7d7d1"}
        crestColor={isDark ? "#4fd486" : "#1e8c4e"}
        speed={0.22}
        amplitude={1.8}
        brightness={isDark ? 0.66 : 0.82}
        opacity={isDark ? 0.72 : 0.42}
        grain
        grainIntensity={0.04}
        mouseInteraction
        detail="medium"
      />
      <div
        className={
          isDark
            ? "absolute inset-0 bg-[#101210]/55"
            : "absolute inset-0 bg-[#e8e8e4]/55"
        }
      />
    </div>
  );
}
