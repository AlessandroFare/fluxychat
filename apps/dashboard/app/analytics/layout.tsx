import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Analytics & costs: FluxyChat",
  description:
    "Room stats, cost estimates, SLO indicators, launch KPIs, and performance benchmarks.",
  path: "/analytics",
});

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
