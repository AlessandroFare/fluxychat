import { describe, expect, it } from "vitest";
import {
  createMcpClient,
  createMcpRegistry,
  fluxyChatResultToMcp,
  mcpToolsToFluxyChat,
  type McpServerConfig,
  type McpToolResult,
} from "./mcp-integration";

describe("mcpToolsToFluxyChat", () => {
  it("converts MCP tools to FluxyChat format", () => {
    const tools = [
      { name: "get_weather", description: "Get weather", inputSchema: { type: "object", properties: { city: { type: "string" } } } },
    ];
    const result = mcpToolsToFluxyChat(tools);
    expect(result).toEqual([
      {
        type: "function",
        function: {
          name: "get_weather",
          description: "Get weather",
          parameters: { type: "object", properties: { city: { type: "string" } } },
        },
      },
    ]);
  });
});

describe("fluxyChatResultToMcp", () => {
  it("converts a string result", () => {
    const result = fluxyChatResultToMcp("hello");
    expect(result).toEqual({ content: [{ type: "text", text: "hello" }], isError: false });
  });

  it("converts an object result", () => {
    const result = fluxyChatResultToMcp({ temp: 22 });
    expect(result).toEqual({ content: [{ type: "text", text: JSON.stringify({ temp: 22 }, null, 2) }], isError: false });
  });
});

describe("createMcpClient (HTTP transport)", () => {
  it("creates a client that can connect/disconnect", async () => {
    const client = createMcpClient({
      name: "test-server",
      url: "http://localhost:18999/mcp",
      transport: "streamable-http",
    });
    expect(client.isConnected()).toBe(false);
    try {
      await client.connect();
    } catch {
      // expected: no server running
    }
    expect(client.getServerInfo().name).toBe("test-server");
  });

  it("creates a client with SSE transport", () => {
    const client = createMcpClient({
      name: "sse-server",
      url: "http://localhost:18999/sse",
      transport: "sse",
    });
    expect(client.isConnected()).toBe(false);
  });
});

describe("createMcpRegistry", () => {
  it("manages multiple MCP servers", () => {
    const registry = createMcpRegistry();
    registry.register({
      name: "server-a",
      url: "http://localhost:18999/a",
      transport: "streamable-http",
    });
    registry.register({
      name: "server-b",
      url: "http://localhost:18999/b",
      transport: "streamable-http",
    });
    const status = registry.getStatus();
    expect(status).toHaveLength(2);
    expect(status.map((s) => s.name).sort()).toEqual(["server-a", "server-b"]);
  });

  it("prevents duplicate registration", () => {
    const registry = createMcpRegistry();
    registry.register({ name: "dup", url: "http://localhost:1/mcp" });
    expect(() => registry.register({ name: "dup", url: "http://localhost:2/mcp" })).toThrow("already registered");
  });

  it("disconnectAll does not throw when nothing connected", async () => {
    const registry = createMcpRegistry();
    registry.register({ name: "offline", url: "http://localhost:1/mcp" });
    await expect(registry.disconnectAll()).resolves.toBeUndefined();
  });
});
