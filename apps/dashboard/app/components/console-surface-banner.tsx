"use client";

import Link from "next/link";
import { getDashboardSurfaceKind } from "@/lib/dashboard-feature-flags";
import { HOSTED_PATHS } from "@/lib/hosted-product";
import { SimulatedPreviewBanner } from "./simulated-preview-banner";

/**
 * Chrome-level label for surfaces the product ships as labs or preview: rendered
 * once above the page instead of repeating a banner on every route.
 */
export function ConsoleSurfaceBanner({ pathname }: { pathname: string | null }) {
  const kind = getDashboardSurfaceKind(pathname);
  if (kind === "ga") return null;

  return (
    <div className="px-4 pt-3 lg:px-6">
      {kind === "labs" ? (
        <SimulatedPreviewBanner label="Labs surface.">
          Preview quality, no SLA. Everything that reads your Worker is real; anything not wired
          yet is labeled as demo data. The honest list lives in{" "}
          <Link
            href={HOSTED_PATHS.labs}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            the platform catalog
          </Link>
          .
        </SimulatedPreviewBanner>
      ) : (
        <SimulatedPreviewBanner label="Preview surface.">
          Built to be inspectable, not certified. SDK sample tables stand in wherever a Worker
          endpoint is still missing.
        </SimulatedPreviewBanner>
      )}
    </div>
  );
}
