import { describe, expect, it } from "vitest";
import {
  CONSOLE_NAV_GROUPS,
  flattenConsoleNavItems,
  isConsoleNavItemActive,
} from "./console-nav";

describe("console nav structure", () => {
  it("labels the groups in sidebar order", () => {
    expect(CONSOLE_NAV_GROUPS.map((group) => group.label)).toEqual([
      "Build",
      "Agents",
      "Connect",
      "Operate",
      "Trust & compliance",
      "AI & dev tools",
      "Platform",
      "Labs",
      "Account",
    ]);
  });

  it("keeps every group single-level (items only)", () => {
    for (const group of CONSOLE_NAV_GROUPS) {
      expect(group.subgroups, group.label).toBeUndefined();
    }
  });

  it("opens only Build by default", () => {
    expect(
      CONSOLE_NAV_GROUPS.filter((group) => group.defaultOpen).map((group) => group.label),
    ).toEqual(["Build"]);
  });

  it("keeps lab surfaces and marketing hubs in the Labs group", () => {
    const labs = CONSOLE_NAV_GROUPS.find((group) => group.label === "Labs");
    const hrefs = (labs?.items ?? []).map((item) => item.href);
    for (const href of [
      "/huddles",
      "/stream/demo",
      "/spatial",
      "/transport",
      "/truth-market",
      "/cartography",
      "/labs",
      "/features",
      "/features/realtime",
    ]) {
      expect(hrefs, href).toContain(href);
    }
  });

  it("keeps lab surfaces out of Platform", () => {
    const platform = CONSOLE_NAV_GROUPS.find((group) => group.label === "Platform");
    const hrefs = (platform?.items ?? []).map((item) => item.href);
    expect(hrefs).not.toContain("/spatial");
    expect(hrefs).not.toContain("/transport");
  });

  it("lists Settings once, under Account", () => {
    const settings = flattenConsoleNavItems().filter((item) => item.href === "/settings");
    expect(settings).toHaveLength(1);
    const account = CONSOLE_NAV_GROUPS.find((group) => group.label === "Account");
    expect((account?.items ?? []).map((item) => item.href)).toEqual([
      "/profile",
      "/notifications",
      "/user-activity",
      "/billing",
      "/settings",
    ]);
  });
});

describe("console-exit nav destinations", () => {
  it("opens public marketing pages in a new tab so the console is not ejected", () => {
    const byHref = new Map(flattenConsoleNavItems().map((item) => [item.href, item]));
    for (const href of ["/labs", "/features", "/features/realtime"]) {
      expect(byHref.get(href)?.newTab, href).toBe(true);
    }
    expect(byHref.get("/transcripts")?.newTab).toBeUndefined();
  });
});

describe("isConsoleNavItemActive", () => {
  it("matches exact routes", () => {
    expect(isConsoleNavItemActive("/features", "/features")).toBe(true);
    expect(isConsoleNavItemActive("/features/realtime", "/features/realtime")).toBe(true);
  });

  it("lets the deepest configured feature route win", () => {
    expect(isConsoleNavItemActive("/features", "/features/realtime")).toBe(false);
    expect(isConsoleNavItemActive("/features/realtime", "/features/realtime")).toBe(true);
    expect(isConsoleNavItemActive("/features", "/features/realtime/location")).toBe(false);
    expect(isConsoleNavItemActive("/features/realtime", "/features/realtime/location")).toBe(true);
  });

  it("keeps ordinary nested routes active", () => {
    expect(isConsoleNavItemActive("/rooms", "/rooms/room-42")).toBe(true);
    expect(isConsoleNavItemActive("/agents", "/agents/new")).toBe(true);
  });

  it("does not match partial path segments", () => {
    expect(isConsoleNavItemActive("/features", "/features-extra")).toBe(false);
    expect(isConsoleNavItemActive("/rooms", "/rooms-and-more")).toBe(false);
  });

  it("handles the root route and missing pathnames", () => {
    expect(isConsoleNavItemActive("/", "/")).toBe(true);
    expect(isConsoleNavItemActive("/", "/rooms")).toBe(false);
    expect(isConsoleNavItemActive("/features", null)).toBe(false);
  });
});
