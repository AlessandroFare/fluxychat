import { describe, expect, it } from "vitest";
import { clerkPublicRoutePatterns, isPublicSitePath } from "./public-site-paths";

describe("isPublicSitePath", () => {
  it("allows trust and marketing pages without a console session", () => {
    expect(isPublicSitePath("/subprocessors")).toBe(true);
    expect(isPublicSitePath("/health")).toBe(true);
    expect(isPublicSitePath("/privacy")).toBe(true);
    expect(isPublicSitePath("/security")).toBe(true);
    expect(isPublicSitePath("/status")).toBe(true);
    expect(isPublicSitePath("/compare")).toBe(true);
    expect(isPublicSitePath("/pricing")).toBe(true);
  });

  it("keeps operator tools behind sign-in", () => {
    expect(isPublicSitePath("/rooms")).toBe(false);
    expect(isPublicSitePath("/dashboard")).toBe(false);
    expect(isPublicSitePath("/settings")).toBe(false);
    expect(isPublicSitePath("/iot")).toBe(false);
  });
});

describe("clerkPublicRoutePatterns", () => {
  it("covers subprocessors and health as exact paths and children", () => {
    const patterns = clerkPublicRoutePatterns();
    expect(patterns).toContain("/subprocessors");
    expect(patterns).toContain("/subprocessors/(.*)");
    expect(patterns).toContain("/health");
    expect(patterns).toContain("/health/(.*)");
  });
});
