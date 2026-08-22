"use client";

import { useTheme } from "@/app/components/theme-provider";
import { CloudflareCostTable } from "./cloudflare-cost-table";

export function CloudflareCostTableThemed() {
  const { resolvedTheme } = useTheme();
  return <CloudflareCostTable variant={resolvedTheme === "dark" ? "dark" : "light"} />;
}
