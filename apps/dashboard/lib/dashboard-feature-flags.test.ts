import { describe, expect, it } from "vitest";
import {
  DASHBOARD_LAB_HREFS,
  DASHBOARD_PREVIEW_HREFS,
  filterDashboardNavItems,
  isDashboardNavHrefVisible,
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

  it("documents preview and lab overlap", () => {
    for (const href of DASHBOARD_LAB_HREFS) {
      expect(DASHBOARD_PREVIEW_HREFS.has(href)).toBe(true);
    }
  });
});
