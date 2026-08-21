import { describe, expect, it } from "vitest";
import {
  DASHBOARD_LAB_HREFS,
  DASHBOARD_PREVIEW_HREFS,
  filterDashboardNavItems,
  isDashboardNavHrefVisible,
  getDashboardSurfaceKind,
} from "./dashboard-feature-flags";

describe("dashboard-feature-flags", () => {
  it("hides lab hrefs by default", () => {
    for (const href of DASHBOARD_LAB_HREFS) {
      expect(isDashboardNavHrefVisible(href, { labsShowcase: false, previewTools: false })).toBe(
        false,
      );
    }
  });

  it("shows preview hrefs when preview flag is set", () => {
    expect(
      isDashboardNavHrefVisible("/marketplace", { labsShowcase: false, previewTools: true }),
    ).toBe(true);
  });

  it("filterDashboardNavItems keeps core routes", () => {
    const filtered = filterDashboardNavItems(
      [
        { href: "/rooms", label: "Rooms" },
        { href: "/inbox", label: "Inbox" },
        { href: "/marketplace", label: "Marketplace" },
      ],
      { labsShowcase: false, previewTools: false },
    );
    expect(filtered.map((i) => i.href)).toEqual(["/rooms", "/inbox"]);
  });

  it("keeps lab and preview href sets disjoint", () => {
    for (const href of DASHBOARD_LAB_HREFS) {
      expect(DASHBOARD_PREVIEW_HREFS.has(href)).toBe(false);
    }
  });

  it("always shows the labs catalog hub", () => {
    expect(isDashboardNavHrefVisible("/labs", { labsShowcase: false, previewTools: false })).toBe(
      true,
    );
  });

  it("hides agent observability behind preview", () => {
    expect(
      isDashboardNavHrefVisible("/agents/observability", {
        labsShowcase: false,
        previewTools: false,
      }),
    ).toBe(false);
  });

  it("classifies deep lab and preview paths", () => {
    expect(getDashboardSurfaceKind("/game")).toBe("labs");
    expect(getDashboardSurfaceKind("/stream/abc/broadcast")).toBe("labs");
    expect(getDashboardSurfaceKind("/agents/platform")).toBe("preview");
    expect(getDashboardSurfaceKind("/rooms")).toBe("ga");
  });
});
