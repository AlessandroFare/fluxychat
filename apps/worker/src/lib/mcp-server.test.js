import { describe, expect, it, vi } from "vitest";
import {
  handleMcpRequest,
  MCP_SERVER_INFO,
  MCP_TOOLS,
} from "./mcp-server.js";
import { MCP_LEGACY_PROTOCOL_VERSION, MCP_PROTOCOL_VERSION } from "./mcp-protocol.js";
import { incrementOperationalMetric } from "./operational-metrics.js";

vi.mock("./operational-metrics.js", () => ({
  incrementOperationalMetric: vi.fn(async () => {}),
}));

vi.mock("./mcp-room-message.js", () => ({
  publishMcpRoomMessage: vi.fn(async (_env, input) => ({
    ok: true,
    message: {
      id: 99,
      roomId: input.roomId,
      content: input.content,
      createdAt: "2026-08-12T12:00:00.000Z",
      clientMessageId: "mcp_test",
    },
  })),
}));

vi.mock("./room-access.js", () => ({
  canAccessRoom: vi.fn(async (_env, _auth, roomId) => roomId === "room_1"),
}));

describe("MCP Server", () => {
  const auth = {
    projectId: "proj_1",
    userId: "user_1",
    roles: ["member"],
  };

  function createMcpEnv(overrides = {}) {
    const rooms = [
      { id: "room_1", name: "General", type: "group", created_at: "2026-06-01T00:00:00.000Z" },
      { id: "room_2", name: "Support", type: "group", created_at: "2026-06-02T00:00:00.000Z" },
    ];
    const messages = [
      { id: "msg_1", project_id: "proj_1", room_id: "room_1", user_id: "alice", content: "Hello world", kind: "text", created_at: "2026-06-10T10:00:00.000Z", updated_at: null, deleted_at: null },
      { id: "msg_2", project_id: "proj_1", room_id: "room_1", user_id: "bob", content: "Hi there", kind: "text", created_at: "2026-06-10T10:01:00.000Z", updated_at: null, deleted_at: null },
    ];
    const members = [
      { room_id: "room_1", user_id: "user_1" },
      { room_id: "room_2", user_id: "user_1" },
    ];

    return {
      DB: {
        prepare(sql) {
          return {
            bind(...args) {
              return {
                async first() {
                  if (sql.includes("SELECT id, name, type")) {
                    const roomId = args[0];
                    return rooms.find((r) => r.id === roomId) || null;
                  }
                  if (sql.includes("COUNT(*) FROM room_members")) {
                    return { cnt: 2 };
                  }
                  if (sql.includes("COUNT(*) FROM messages")) {
                    return { cnt: 5 };
                  }
                  return null;
                },
                async all() {
                  if (sql.includes("FROM rooms r") && sql.includes("room_members rm")) {
                    return { results: rooms.filter((r) => members.some((m) => m.room_id === r.id && m.user_id === args[0])) };
                  }
                  if (sql.includes("FROM messages") && sql.includes("ORDER BY created_at DESC")) {
                    return { results: messages.filter((m) => m.room_id === args[1]) };
                  }
                  return { results: [] };
                },
                async run() {
                  return { success: true };
                },
              };
            },
          };
        },
      },
      RATE_LIMIT_MCP_MESSAGES_PER_MINUTE: "1000",
      RATE_LIMIT_FALLBACK_ALLOW: "true",
      ...overrides,
    };
  }

  function createLogError() {
    return () => {};
  }

  describe("initialize", () => {
    it("returns legacy protocol when params omit a version", async () => {
      const result = await handleMcpRequest(
        { method: "initialize", params: {}, id: 1 },
        { env: createMcpEnv(), auth, logError: createLogError() },
      );
      expect(result.jsonrpc).toBe("2.0");
      expect(result.id).toBe(1);
      expect(result.result.protocolVersion).toBe(MCP_LEGACY_PROTOCOL_VERSION);
      expect(result.result.serverInfo).toEqual(MCP_SERVER_INFO);
      expect(result.result.capabilities.tools).toBeDefined();
    });
  });

  describe("server/discover", () => {
    it("advertises 2026-07-28 and supported versions", async () => {
      const result = await handleMcpRequest(
        { method: "server/discover", params: {}, id: "discover-1" },
        { env: createMcpEnv(), auth, logError: createLogError() },
      );
      expect(result.result.resultType).toBe("complete");
      expect(result.result.supportedVersions).toContain(MCP_PROTOCOL_VERSION);
      expect(result.result.supportedVersions).toContain(MCP_LEGACY_PROTOCOL_VERSION);
      expect(result.result.capabilities.tools).toBeDefined();
    });
  });

  describe("tools/list", () => {
    it("returns all MCP tools", async () => {
      const result = await handleMcpRequest(
        { method: "tools/list", params: {}, id: 2 },
        { env: createMcpEnv(), auth, logError: createLogError() },
      );
      expect(result.result.tools).toHaveLength(MCP_TOOLS.length);
      expect(result.result.tools.map((t) => t.name)).toContain("list_rooms");
      expect(result.result.tools.map((t) => t.name)).toContain("get_room_messages");
      expect(result.result.tools.map((t) => t.name)).toContain("send_message");
      expect(result.result.tools.map((t) => t.name)).toContain("search_chat");
      expect(result.result.tools.map((t) => t.name)).toContain("get_room_info");
    });

    it("each tool has required fields plus title and annotations", async () => {
      const result = await handleMcpRequest(
        { method: "tools/list", params: {}, id: 3 },
        { env: createMcpEnv(), auth, logError: createLogError() },
      );
      for (const tool of result.result.tools) {
        expect(tool.name).toBeTruthy();
        expect(tool.title).toBeTruthy();
        expect(tool.description).toBeTruthy();
        expect(tool.annotations).toBeTruthy();
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe("object");
        expect(tool.outputSchema).toBeDefined();
        expect(tool.outputSchema.type).toBe("object");
      }
    });

    it("marks read-only tools and write tools with spec annotations", async () => {
      const result = await handleMcpRequest(
        { method: "tools/list", params: {}, id: 6 },
        { env: createMcpEnv(), auth, logError: createLogError() },
      );
      const byName = Object.fromEntries(result.result.tools.map((t) => [t.name, t]));
      expect(byName.list_rooms.annotations.readOnlyHint).toBe(true);
      expect(byName.search_chat.annotations.readOnlyHint).toBe(true);
      expect(byName.send_message.annotations.readOnlyHint).toBeUndefined();
      expect(byName.send_message.annotations.destructiveHint).toBe(false);
    });

    it("counts handled requests into per-method mcp_requests metrics", async () => {
      incrementOperationalMetric.mockClear();
      await handleMcpRequest(
        { method: "tools/list", params: {}, id: 7 },
        { env: createMcpEnv(), auth, logError: createLogError() },
      );
      expect(incrementOperationalMetric).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          metricName: "mcp_requests.tools_list",
          projectId: "proj_1",
          value: 1,
        }),
      );
    });
  });

  describe("ping", () => {
    it("returns empty result", async () => {
      const result = await handleMcpRequest(
        { method: "ping", params: {}, id: 4 },
        { env: createMcpEnv(), auth, logError: createLogError() },
      );
      expect(result.result).toEqual({});
    });
  });

  describe("unknown method", () => {
    it("returns method not found error", async () => {
      const result = await handleMcpRequest(
        { method: "nonexistent", params: {}, id: 5 },
        { env: createMcpEnv(), auth, logError: createLogError() },
      );
      expect(result.error.code).toBe(-32601);
      expect(result.error.message).toContain("not found");
    });
  });

  describe("tool: list_rooms", () => {
    it("returns rooms the user is a member of", async () => {
      const result = await handleMcpRequest(
        { method: "tools/call", params: { name: "list_rooms", arguments: {} }, id: 10 },
        { env: createMcpEnv(), auth, logError: createLogError() },
      );
      expect(result.result.isError).toBeUndefined();
      const data = JSON.parse(result.result.content[0].text);
      expect(data.rooms).toBeDefined();
      expect(Array.isArray(data.rooms)).toBe(true);
      expect(result.result.structuredContent).toEqual(data);
    });

    it("respects limit parameter", async () => {
      const result = await handleMcpRequest(
        { method: "tools/call", params: { name: "list_rooms", arguments: { limit: 1 } }, id: 11 },
        { env: createMcpEnv(), auth, logError: createLogError() },
      );
      const data = JSON.parse(result.result.content[0].text);
      expect(data.limit).toBe(1);
    });
  });

  describe("tool: get_room_messages", () => {
    it("returns messages from a room", async () => {
      const result = await handleMcpRequest(
        {
          method: "tools/call",
          params: { name: "get_room_messages", arguments: { roomId: "room_1" } },
          id: 20,
        },
        { env: createMcpEnv(), auth, logError: createLogError() },
      );
      expect(result.result.isError).toBeUndefined();
      const data = JSON.parse(result.result.content[0].text);
      expect(data.messages).toBeDefined();
      expect(data.roomId).toBe("room_1");
    });

    it("returns error when roomId is missing", async () => {
      const result = await handleMcpRequest(
        {
          method: "tools/call",
          params: { name: "get_room_messages", arguments: {} },
          id: 21,
        },
        { env: createMcpEnv(), auth, logError: createLogError() },
      );
      expect(result.result.isError).toBe(true);
      expect(result.result.content[0].text).toContain("roomId is required");
      expect(result.result.structuredContent).toBeUndefined();
    });
  });

  describe("tool: send_message", () => {
    it("sends a message successfully", async () => {
      const result = await handleMcpRequest(
        {
          method: "tools/call",
          params: {
            name: "send_message",
            arguments: { roomId: "room_1", content: "Hello from MCP!" },
          },
          id: 30,
        },
        { env: createMcpEnv(), auth, logError: createLogError() },
      );
      expect(result.result.isError).toBeUndefined();
      const data = JSON.parse(result.result.content[0].text);
      expect(data.status).toBe("sent");
      expect(data.content).toBe("Hello from MCP!");
      expect(data.id).toBe(99);
    });

    it("returns error when content is empty", async () => {
      const result = await handleMcpRequest(
        {
          method: "tools/call",
          params: { name: "send_message", arguments: { roomId: "room_1", content: "" } },
          id: 31,
        },
        { env: createMcpEnv(), auth, logError: createLogError() },
      );
      expect(result.result.isError).toBe(true);
    });

    it("returns error when roomId is missing", async () => {
      const result = await handleMcpRequest(
        {
          method: "tools/call",
          params: { name: "send_message", arguments: { content: "test" } },
          id: 32,
        },
        { env: createMcpEnv(), auth, logError: createLogError() },
      );
      expect(result.result.isError).toBe(true);
    });
  });

  describe("tool: search_chat", () => {
    it("returns error when query is empty", async () => {
      const result = await handleMcpRequest(
        {
          method: "tools/call",
          params: { name: "search_chat", arguments: {} },
          id: 40,
        },
        { env: createMcpEnv(), auth, logError: createLogError() },
      );
      expect(result.result.isError).toBe(true);
      expect(result.result.content[0].text).toContain("query is required");
    });
  });

  describe("tool: get_room_info", () => {
    it("returns room details", async () => {
      const result = await handleMcpRequest(
        {
          method: "tools/call",
          params: { name: "get_room_info", arguments: { roomId: "room_1" } },
          id: 50,
        },
        { env: createMcpEnv(), auth, logError: createLogError() },
      );
      expect(result.result.isError).toBeUndefined();
      const data = JSON.parse(result.result.content[0].text);
      expect(data.id).toBe("room_1");
      expect(data.name).toBe("General");
    });

    it("returns error for unknown room", async () => {
      const result = await handleMcpRequest(
        {
          method: "tools/call",
          params: { name: "get_room_info", arguments: { roomId: "nonexistent" } },
          id: 51,
        },
        { env: createMcpEnv(), auth, logError: createLogError() },
      );
      expect(result.result.isError).toBe(true);
      expect(result.result.content[0].text).toContain("not found");
    });

    it("returns error when roomId is missing", async () => {
      const result = await handleMcpRequest(
        {
          method: "tools/call",
          params: { name: "get_room_info", arguments: {} },
          id: 52,
        },
        { env: createMcpEnv(), auth, logError: createLogError() },
      );
      expect(result.result.isError).toBe(true);
    });
  });

  describe("tool error handling", () => {
    it("returns error for unknown tool", async () => {
      const result = await handleMcpRequest(
        {
          method: "tools/call",
          params: { name: "nonexistent_tool", arguments: {} },
          id: 60,
        },
        { env: createMcpEnv(), auth, logError: createLogError() },
      );
      expect(result.result.isError).toBe(true);
      expect(result.result.content[0].text).toContain("Unknown tool");
    });
  });

  describe("modern 2026-07-28", () => {
    it("tools/list includes resultType and cache hints", async () => {
      const headers = new Headers({
        "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
        "Mcp-Method": "tools/list",
      });
      const result = await handleMcpRequest(
        {
          method: "tools/list",
          params: {
            _meta: { "io.modelcontextprotocol/protocolVersion": MCP_PROTOCOL_VERSION },
          },
          id: 70,
        },
        { env: createMcpEnv(), auth, logError: createLogError(), requestHeaders: headers },
      );
      expect(result.result.resultType).toBe("complete");
      expect(result.result.ttlMs).toBeGreaterThan(0);
      expect(result.result.cacheScope).toBe("private");
      expect(result.result.tools).toHaveLength(MCP_TOOLS.length);
    });

    it("send_message without content elicits from a capable client", async () => {
      const headers = new Headers({
        "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
        "Mcp-Method": "tools/call",
        "Mcp-Name": "send_message",
      });
      const result = await handleMcpRequest(
        {
          method: "tools/call",
          params: {
            name: "send_message",
            arguments: { roomId: "room_1" },
            _meta: {
              "io.modelcontextprotocol/protocolVersion": MCP_PROTOCOL_VERSION,
              "io.modelcontextprotocol/clientCapabilities": { elicitation: {} },
            },
          },
          id: 71,
        },
        { env: createMcpEnv(), auth, logError: createLogError(), requestHeaders: headers },
      );
      expect(result.result.resultType).toBe("input_required");
      // MRTR InputRequests is a map keyed by request id (2026-07-28).
      expect(result.result.inputRequests["elicit-1"].method).toBe("elicitation/create");
    });

    it("refuses to elicit from a client that never declared the capability", async () => {
      const headers = new Headers({
        "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
        "Mcp-Method": "tools/call",
        "Mcp-Name": "send_message",
      });
      const result = await handleMcpRequest(
        {
          method: "tools/call",
          params: { name: "send_message", arguments: { roomId: "room_1" } },
          id: 73,
        },
        { env: createMcpEnv(), auth, logError: createLogError(), requestHeaders: headers },
      );
      expect(result.result).toBeUndefined();
      expect(result.httpStatus).toBe(400);
      expect(result.error.code).toBe(-32021);
      expect(result.error.data.requiredCapabilities).toEqual({ elicitation: {} });
    });

    it("answers resources/templates/list with the resourceTemplates key", async () => {
      const headers = new Headers({
        "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
        "Mcp-Method": "resources/templates/list",
      });
      const result = await handleMcpRequest(
        {
          method: "resources/templates/list",
          params: { _meta: { "io.modelcontextprotocol/protocolVersion": MCP_PROTOCOL_VERSION } },
          id: 74,
        },
        { env: createMcpEnv(), auth, logError: createLogError(), requestHeaders: headers },
      );
      expect(result.result.resourceTemplates).toEqual([]);
      expect(result.result.resources).toBeUndefined();
    });

    it("retries send_message with inputResponses", async () => {
      const headers = new Headers({
        "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
        "Mcp-Method": "tools/call",
        "Mcp-Name": "send_message",
      });
      const result = await handleMcpRequest(
        {
          method: "tools/call",
          params: {
            name: "send_message",
            arguments: { roomId: "room_1" },
            inputResponses: {
              "elicit-1": { action: "accept", content: { content: "Hello after elicit" } },
            },
          },
          id: 72,
        },
        { env: createMcpEnv(), auth, logError: createLogError(), requestHeaders: headers },
      );
      expect(result.result.resultType).toBe("complete");
      const data = JSON.parse(result.result.content[0].text);
      expect(data.content).toBe("Hello after elicit");
      expect(data.status).toBe("sent");
    });
  });
});
