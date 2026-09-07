/**
 * Dashboard nav visibility. Platform modules ship as production in the sidebar.
 * Env flags remain for emergency hide-only; default is show everything.
 */

function readEnvFlag(name: string, defaultValue = true): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "yes") return true;
  if (raw === "0" || raw === "false" || raw === "no") return false;
  return defaultValue;
}

export function getDashboardFeatureFlags() {
  return {
    labsShowcase: readEnvFlag("NEXT_PUBLIC_DASHBOARD_LABS", true),
    previewTools: readEnvFlag("NEXT_PUBLIC_DASHBOARD_PREVIEW", true),
  };
}

/** @deprecated Use getDashboardFeatureFlags() — kept for static nav module init. */
export const dashboardFeatureFlags = getDashboardFeatureFlags();

/** Product + industry routes (always in sidebar). */
export const DASHBOARD_LAB_HREFS = new Set([
  "/continuity",
  "/stream",
  "/stream/demo",
  "/spatial",
  "/transport",
  "/huddles",
  "/voice-ai",
  "/edu",
  "/health",
  "/events",
  "/finance",
  "/truth-market",
  "/cartography",
]);

/** Additional platform routes (always in sidebar). */
export const DASHBOARD_PREVIEW_HREFS = new Set([
  "/web3",
  "/driver",
  "/marketplace",
  "/cross-channel",
  "/agents/platform",
  "/agents/a2a",
  "/agents/debate",
  "/agents/rehearsal",
  "/agents/ambient",
  "/agents/observability",
  "/agents/eval",
  "/chatbot-builder",
]);

export type DashboardSurfaceKind = "ga" | "labs" | "preview";

function pathMatchesHref(pathname: string, href: string): boolean {
  const path = pathname.replace(/\/$/, "") || "/";
  return path === href || path.startsWith(`${href}/`);
}

export function matchFlaggedHref(pathname: string, hrefs: Set<string>): string | null {
  const path = pathname.replace(/\/$/, "") || "/";
  let best: string | null = null;
  for (const href of hrefs) {
    if (!pathMatchesHref(path, href)) continue;
    if (!best || href.length > best.length) best = href;
  }
  return best;
}

/** All console surfaces are GA / flagship. */
export function getDashboardSurfaceKind(_pathname: string | null): DashboardSurfaceKind {
  return "ga";
}

export function isDashboardNavHrefVisible(
  _href: string,
  _flags = getDashboardFeatureFlags(),
): boolean {
  return true;
}

export function filterDashboardNavItems<T extends { href: string }>(
  items: T[],
  _flags = getDashboardFeatureFlags(),
): T[] {
  return items;
}
