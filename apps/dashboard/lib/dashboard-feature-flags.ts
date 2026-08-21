/**
 * Dashboard nav visibility — hide incomplete lab/preview routes unless enabled.
 * See docs/feature-flags.md § Dashboard console.
 */

function readEnvFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "yes") return true;
  if (raw === "0" || raw === "false" || raw === "no") return false;
  return defaultValue;
}

export function getDashboardFeatureFlags() {
  return {
    /** Labs & demos nav (stream, game, IoT, fleet, industries, …). Default off in production. */
    labsShowcase: readEnvFlag("NEXT_PUBLIC_DASHBOARD_LABS", false),
    /** Preview surfaces (marketplace, web3, agent platform, …). Default off in production. */
    previewTools: readEnvFlag("NEXT_PUBLIC_DASHBOARD_PREVIEW", false),
  };
}

/** @deprecated Use getDashboardFeatureFlags() — kept for static nav module init. */
export const dashboardFeatureFlags = getDashboardFeatureFlags();

/** Showcase / vertical modules — sidebar only when NEXT_PUBLIC_DASHBOARD_LABS=1. */
export const DASHBOARD_LAB_HREFS = new Set([
  "/continuity",
  "/stream",
  "/stream/demo",
  "/game",
  "/iot",
  "/fleet",
  "/spatial",
  "/transport",
  "/collab",
  "/huddles",
  "/voice-ai",
  "/edu",
  "/health",
  "/events",
  "/finance",
  "/truth-market",
  "/cartography",
]);

/** Early-preview routes — sidebar only when NEXT_PUBLIC_DASHBOARD_PREVIEW=1. */
export const DASHBOARD_PREVIEW_HREFS = new Set([
  "/web3",
  "/driver",
  "/marketplace",
  "/cross-channel",
  "/agents/platform",
  "/agents/a2a",
  "/agents/cross-org",
  "/agents/debate",
  "/agents/rehearsal",
  "/agents/ambient",
  "/chatbot-builder",
]);

export function isDashboardNavHrefVisible(
  href: string,
  flags = getDashboardFeatureFlags(),
): boolean {
  if (DASHBOARD_LAB_HREFS.has(href)) return flags.labsShowcase;
  if (DASHBOARD_PREVIEW_HREFS.has(href)) return flags.previewTools;
  return true;
}

export function filterDashboardNavItems<T extends { href: string }>(
  items: T[],
  flags = getDashboardFeatureFlags(),
): T[] {
  return items.filter((item) => isDashboardNavHrefVisible(item.href, flags));
}
