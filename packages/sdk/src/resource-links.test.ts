import { describe, it, expect } from "vitest";
import { createResourceLinkManager } from "./resource-links";

describe("createResourceLinkManager", () => {
  it("creates a resource link", () => {
    const rlm = createResourceLinkManager();
    const link = rlm.createLink({
      uri: "https://example.com/doc",
      name: "Doc",
      description: "A document",
    });
    expect(link.type).toBe("resource_link");
    expect(link.uri).toBe("https://example.com/doc");
    expect(link.name).toBe("Doc");
  });

  it("validateUri allows valid https", () => {
    const rlm = createResourceLinkManager();
    expect(rlm.validateUri("https://example.com")).toBe(true);
  });

  it("validateUri blocks invalid schemes", () => {
    const rlm = createResourceLinkManager();
    expect(rlm.validateUri("ftp://example.com")).toBe(false);
  });

  it("validateUri blocks blocked domains", () => {
    const rlm = createResourceLinkManager({ blockedDomains: ["evil.com"] });
    expect(rlm.validateUri("https://evil.com")).toBe(false);
    expect(rlm.validateUri("https://sub.evil.com")).toBe(false);
  });

  it("validateUri allows non-blocked domains", () => {
    const rlm = createResourceLinkManager({ blockedDomains: ["evil.com"] });
    expect(rlm.validateUri("https://safe.com")).toBe(true);
  });

  it("setUriPolicy updates policy", () => {
    const rlm = createResourceLinkManager();
    rlm.setUriPolicy({ allowedSchemes: ["https"], blockedDomains: ["bad.com"] });
    expect(rlm.validateUri("http://example.com")).toBe(false);
    expect(rlm.validateUri("https://bad.com")).toBe(false);
    expect(rlm.validateUri("https://good.com")).toBe(true);
  });

  it("getUriPolicy returns current policy", () => {
    const rlm = createResourceLinkManager({ allowedSchemes: ["https"] });
    const policy = rlm.getUriPolicy();
    expect(policy.allowedSchemes).toEqual(["https"]);
  });

  it("fetchResource fetches and caches", async () => {
    const rlm = createResourceLinkManager();
    const result = await rlm.fetchResource("https://example.com/doc");
    expect(result.content).toBeDefined();
    expect(result.fetchedAt).toBeGreaterThan(0);
    expect(rlm.getCache().size).toBe(1);
  });

  it("fetchResource throws for invalid URI", async () => {
    const rlm = createResourceLinkManager({ allowedSchemes: ["https"] });
    await expect(rlm.fetchResource("ftp://bad.com")).rejects.toThrow("blocked by policy");
  });

  it("clearCache empties the cache", async () => {
    const rlm = createResourceLinkManager();
    await rlm.fetchResource("https://example.com/doc");
    expect(rlm.getCache().size).toBe(1);
    rlm.clearCache();
    expect(rlm.getCache().size).toBe(0);
  });

  it("fetchResource returns cached result", async () => {
    const rlm = createResourceLinkManager();
    const r1 = await rlm.fetchResource("https://example.com/doc");
    const r2 = await rlm.fetchResource("https://example.com/doc");
    expect(r2.fetchedAt).toBe(r1.fetchedAt);
  });
});
