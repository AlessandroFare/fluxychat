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
    labsShowcase: readEnvFlag("NEXT_PUBLIC_DASHBOARD_LABS", true),
    /** Preview dev tools (web3, driver, …). */
    previewTools: readEnvFlag("NEXT_PUBLIC_DASHBOARD_PREVIEW", true),
  };
}

/** @deprecated Use getDashboardFeatureFlags() — kept for static nav module init. */
export const dashboardFeatureFlags = getDashboardFeatureFlags();

/** Truly experimental routes — hidden unless NEXT_PUBLIC_DASHBOARD_LABS=false explicitly. */
export const DASHBOARD_LAB_HREFS = new Set(["/continuity"]);

/** Early-preview routes — hidden only when NEXT_PUBLIC_DASHBOARD_PREVIEW=false. */
export const DASHBOARD_PREVIEW_HREFS = new Set(["/web3", "/driver"]);

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
