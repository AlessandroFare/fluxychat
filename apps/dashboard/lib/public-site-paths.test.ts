import { describe, expect, it } from "vitest";
import { clerkPublicRoutePatterns, isPublicSitePath } from "./public-site-paths";

describe("isPublicSitePath", () => {
  it("allows marketing pages and the subprocessors list without a console session", () => {
    expect(isPublicSitePath("/subprocessors")).toBe(true);
    expect(isPublicSitePath("/status")).toBe(true);
    expect(isPublicSitePath("/compare")).toBe(true);
    expect(isPublicSitePath("/pricing")).toBe(true);
    expect(isPublicSitePath("/features")).toBe(true);
  });

  it("keeps console tools behind sign-in", () => {
    expect(isPublicSitePath("/privacy")).toBe(false);
    expect(isPublicSitePath("/security")).toBe(false);
    expect(isPublicSitePath("/soc2")).toBe(false);
    expect(isPublicSitePath("/embed")).toBe(false);
    expect(isPublicSitePath("/health")).toBe(false);
    expect(isPublicSitePath("/rooms")).toBe(false);
    expect(isPublicSitePath("/dashboard")).toBe(false);
    expect(isPublicSitePath("/settings")).toBe(false);
    expect(isPublicSitePath("/iot")).toBe(false);
  });
});

describe("clerkPublicRoutePatterns", () => {
  it("covers subprocessors as a public path", () => {
    const patterns = clerkPublicRoutePatterns();
    expect(patterns).toContain("/subprocessors");
    expect(patterns).toContain("/subprocessors/(.*)");
    expect(patterns).not.toContain("/health");
    expect(patterns).not.toContain("/privacy");
  });
});
