import { describe, expect, it } from "vitest";
import {
  DASHBOARD_LAB_HREFS,
  DASHBOARD_PREVIEW_HREFS,
  filterDashboardNavItems,
  isDashboardNavHrefVisible,
  getDashboardSurfaceKind,
} from "./dashboard-feature-flags";

describe("dashboard-feature-flags", () => {
  it("shows every former lab and preview href in the sidebar", () => {
    for (const href of DASHBOARD_LAB_HREFS) {
      expect(isDashboardNavHrefVisible(href, { labsShowcase: false, previewTools: false })).toBe(
        true,
      );
    }
    for (const href of DASHBOARD_PREVIEW_HREFS) {
      expect(isDashboardNavHrefVisible(href, { labsShowcase: false, previewTools: false })).toBe(
        true,
      );
    }
  });

  it("filterDashboardNavItems keeps platform routes", () => {
    const filtered = filterDashboardNavItems(
      [
        { href: "/rooms", label: "Rooms" },
        { href: "/inbox", label: "Inbox" },
        { href: "/marketplace", label: "Marketplace" },
        { href: "/health", label: "Health" },
      ],
      { labsShowcase: false, previewTools: false },
    );
    expect(filtered.map((i) => i.href)).toEqual([
      "/rooms",
      "/inbox",
      "/marketplace",
      "/health",
    ]);
  });

  it("keeps lab and preview href sets disjoint", () => {
    for (const href of DASHBOARD_LAB_HREFS) {
      expect(DASHBOARD_PREVIEW_HREFS.has(href)).toBe(false);
    }
  });

  it("classifies kernel as ga and former labs as labs", () => {
    expect(getDashboardSurfaceKind("/rooms")).toBe("ga");
    expect(getDashboardSurfaceKind("/game")).toBe("ga");
    expect(getDashboardSurfaceKind("/stream/abc/broadcast")).toBe("labs");
    expect(getDashboardSurfaceKind("/agents/platform")).toBe("preview");
  });
});
