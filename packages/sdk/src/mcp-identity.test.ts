import { describe, it, expect } from "vitest";
import { createMcpIdentityManager } from "./mcp-identity";

describe("mcp-identity", () => {
  it("should register a server", () => {
    const m = createMcpIdentityManager();
    m.registerServer({ name: "weather", version: "1.0.0", vendor: "Acme", description: "Weather API" });
    expect(m.listServers()).toHaveLength(1);
  });

  it("should get a server by name", () => {
    const m = createMcpIdentityManager();
    m.registerServer({ name: "weather", version: "1.0.0", vendor: "Acme", description: "Weather API" });
    const server = m.getServer("weather");
    expect(server?.name).toBe("weather");
  });

  it("should set and get instructions", () => {
    const m = createMcpIdentityManager();
    m.registerServer({ name: "math", version: "1.0", vendor: "Calc", description: "Calculator" });
    m.setInstructions("math", "Use this tool for mathematical operations");
    const instr = m.getInstructions("math");
    expect(instr?.instructions).toContain("mathematical");
  });

  it("should create tool provenance", () => {
    const m = createMcpIdentityManager();
    m.registerServer({ name: "search", version: "2.0", vendor: "SearchCo", description: "Web search" });
    const prov = m.createToolProvenance("search", "web_search", "Search the web for current information");
    expect(prov.serverName).toBe("search");
    expect(prov.origin).toBe("installed");
  });

  it("should list tools by server", () => {
    const m = createMcpIdentityManager();
    m.registerServer({ name: "fs", version: "1.0", vendor: "FS", description: "File system" });
    m.createToolProvenance("fs", "read_file", "Read a file");
    m.createToolProvenance("fs", "write_file", "Write a file");
    expect(m.listToolsByServer("fs")).toHaveLength(2);
  });

  it("should throw for unregistered server instructions", () => {
    const m = createMcpIdentityManager();
    expect(() => m.setInstructions("unknown", "test")).toThrow();
  });
});
