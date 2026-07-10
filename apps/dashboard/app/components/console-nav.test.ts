import { describe, expect, it } from "vitest";
import { isConsoleNavItemActive } from "./console-nav";

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
