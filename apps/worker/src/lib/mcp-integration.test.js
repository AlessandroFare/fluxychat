import { describe, expect, it, vi } from "vitest";
import { createMcpClient } from "./mcp-integration.js";

vi.mock("./url-ssrf.js", () => ({
  safeOutboundFetch: vi.fn(),
}));

describe("createMcpClient", () => {
  it("probes server/discover then lists tools", async () => {
    const { safeOutboundFetch } = await import("./url-ssrf.js");
    safeOutboundFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: "2.0",
          id: "1",
          result: { supportedVersions: ["2026-07-28"], capabilities: { tools: {} } },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: "2.0",
          id: "2",
          result: { tools: [{ name: "search", description: "Search", inputSchema: { type: "object" } }] },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: "2.0",
          id: "3",
          result: { tools: [{ name: "search", description: "Search", inputSchema: { type: "object" } }] },
        }),
      });

    const client = createMcpClient({ url: "https://example.com/mcp" });
    await client.connect();
    const tools = await client.listTools();
    expect(tools[0].name).toBe("search");
    expect(safeOutboundFetch).toHaveBeenCalled();
    const firstBody = JSON.parse(safeOutboundFetch.mock.calls[0][1].body);
    expect(firstBody.method).toBe("server/discover");
  });
});
