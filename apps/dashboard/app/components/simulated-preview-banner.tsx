"use client";

import type { ReactNode } from "react";
import { Banner } from "./ui";

interface SimulatedPreviewBannerProps {
  /** Page-specific truth about what is local demo state vs what reads the Worker. */
  children: ReactNode;
  /** Lead label; override for previews that are static rather than simulated. */
  label?: string;
}

/**
 * Uniform honest label for console pages that run on local SDK demo state
 * instead of Worker data. Shown exactly when a page falls back to local state.
 */
export function SimulatedPreviewBanner({
  children,
  label = "Preview — simulated data.",
}: SimulatedPreviewBannerProps) {
  return (
    <Banner variant="info">
      <span className="font-medium">{label}</span> {children}
    </Banner>
  );
}
