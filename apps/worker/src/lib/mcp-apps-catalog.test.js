import { describe, it, expect } from "vitest";
import { listMcpAppsCatalog, getMcpAppById } from "./mcp-apps-catalog.js";

describe("mcp-apps-catalog", () => {
  it("lists curated MCP apps", async () => {
    const apps = await listMcpAppsCatalog({});
    expect(apps.length).toBeGreaterThanOrEqual(5);
    expect(apps.every((a) => a.verified && a.auditLevel === "curated")).toBe(true);
    expect(getMcpAppById("apyhub-mcp")?.docsUrl).toBe("https://apyhub.com/mcp");
  });

  it("finds app by id", () => {
    const app = getMcpAppById("github-mcp");
    expect(app?.name).toBe("GitHub");
    expect(app?.tools).toContain("search_repositories");
  });
});
