import { describe, expect, it } from "vitest";
import { clerkPublicRoutePatterns, isPublicSitePath } from "./public-site-paths";

describe("isPublicSitePath", () => {
  it("allows marketing pages and the subprocessors list without a console session", () => {
    expect(isPublicSitePath("/dpa")).toBe(true);
    expect(isPublicSitePath("/terms")).toBe(true);
    expect(isPublicSitePath("/privacy-policy")).toBe(true);
    expect(isPublicSitePath("/for-teams")).toBe(true);
    expect(isPublicSitePath("/trust")).toBe(true);
    expect(isPublicSitePath("/migrate-chatgpt")).toBe(true);
    expect(isPublicSitePath("/subprocessors")).toBe(true);
    expect(isPublicSitePath("/status")).toBe(true);
    expect(isPublicSitePath("/compare")).toBe(true);
    expect(isPublicSitePath("/compare/sendbird")).toBe(true);
    expect(isPublicSitePath("/compare/cometchat")).toBe(true);
    expect(isPublicSitePath("/pricing")).toBe(true);
    expect(isPublicSitePath("/features")).toBe(true);
    expect(isPublicSitePath("/llms.txt")).toBe(true);
    expect(isPublicSitePath("/r/registry.json")).toBe(true);
    expect(isPublicSitePath("/landing/incident")).toBe(true);
    expect(isPublicSitePath("/incident")).toBe(true);
    expect(isPublicSitePath("/support")).toBe(true);
    expect(isPublicSitePath("/pr-review")).toBe(true);
    expect(isPublicSitePath("/labs")).toBe(true);
    expect(isPublicSitePath("/report")).toBe(true);
    expect(isPublicSitePath("/share/lobby")).toBe(true);
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
    expect(patterns).toContain("/llms.txt");
    expect(patterns).toContain("/r");
    expect(patterns).toContain("/r/(.*)");
    expect(patterns).toContain("/share");
    expect(patterns).toContain("/share/(.*)");
    expect(patterns).not.toContain("/health");
    expect(patterns).not.toContain("/privacy");
  });
});
