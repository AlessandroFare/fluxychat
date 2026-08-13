import { describe, expect, it, vi } from "vitest";
import {
  handleMcpRequest,
  MCP_SERVER_INFO,
  MCP_PROTOCOL_VERSION,
  MCP_TOOLS,
} from "./mcp-server.js";

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
    it("returns server info and protocol version", async () => {
      const result = await handleMcpRequest(
        { method: "initialize", params: {}, id: 1 },
        { env: createMcpEnv(), auth, logError: createLogError() },
      );
      expect(result.jsonrpc).toBe("2.0");
      expect(result.id).toBe(1);
      expect(result.result.protocolVersion).toBe(MCP_PROTOCOL_VERSION);
      expect(result.result.serverInfo).toEqual(MCP_SERVER_INFO);
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

    it("each tool has required fields", async () => {
      const result = await handleMcpRequest(
        { method: "tools/list", params: {}, id: 3 },
        { env: createMcpEnv(), auth, logError: createLogError() },
      );
      for (const tool of result.result.tools) {
        expect(tool.name).toBeTruthy();
        expect(tool.description).toBeTruthy();
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe("object");
      }
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
});
