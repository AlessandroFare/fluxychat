import type { ReactNode } from "react";

/**
 * Marketing route segment — isolates landing bundle from console chrome.
 * Landing content is RSC + lazy client islands (see app/landing/*).
 */
export default function LandingLayout({ children }: { children: ReactNode }) {
  return <div data-marketing-route="landing">{children}</div>;
}
