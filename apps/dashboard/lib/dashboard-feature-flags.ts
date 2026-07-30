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
    /** Labs & demos nav group (stream, game, IoT, fleet showcase, …). */
    labsShowcase: readEnvFlag("NEXT_PUBLIC_DASHBOARD_LABS", false),
    /** Preview dev tools (marketplace, web3, cross-channel, …). */
    previewTools: readEnvFlag("NEXT_PUBLIC_DASHBOARD_PREVIEW", false),
  };
}

/** @deprecated Use getDashboardFeatureFlags() — kept for static nav module init. */
export const dashboardFeatureFlags = getDashboardFeatureFlags();

/** Showcase routes grouped under “Labs & demos”. */
export const DASHBOARD_LAB_HREFS = new Set([
  "/stream",
  "/stream/demo",
  "/game",
  "/iot",
  "/fleet",
  "/web3",
  "/spatial",
  "/collab",
  "/transport",
  "/cross-channel",
  "/driver",
  "/continuity",
]);

/** Dev-tool routes that are preview-quality (hidden unless preview flag). */
export const DASHBOARD_PREVIEW_HREFS = new Set([
  "/fleet",
  "/driver",
  "/marketplace",
  "/chatbot-builder",
  "/cross-channel",
  "/spatial",
  "/web3",
  "/collab",
  "/stream",
  "/stream/demo",
  "/agents/platform",
  "/game",
  "/iot",
  "/transport",
  "/templates/code",
  "/continuity",
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
