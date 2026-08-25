import { describe, expect, it, vi } from "vitest";
import {
  MCP_ROOM_TOOLS,
  assertMcpRoomTokenScope,
  handleMcpRoomRequest,
} from "./mcp-room-server.js";

vi.mock("./mcp-room-message.js", () => ({
  publishMcpRoomMessage: vi.fn(async () => ({
    ok: true,
    message: {
      id: 42,
      roomId: "room_1",
      content: "Hello from MCP",
      createdAt: "2026-08-12T12:00:00.000Z",
      clientMessageId: "mcp_test",
    },
  })),
}));

vi.mock("./room-shard.js", () => ({
  fetchAggregatedRoomLive: vi.fn(async () => ({
    online: true,
    users: ["user_1"],
    userCount: 1,
  })),
}));

describe("MCP room server (PH-100)", () => {
  const auth = {
    projectId: "proj_1",
    userId: "user_1",
    roles: ["member"],
  };

  function createEnv() {
    const messages = [
      {
        id: 1,
        user_id: "alice",
        content: "Hi",
        kind: "text",
        created_at: "2026-08-12T10:00:00.000Z",
        updated_at: null,
        client_message_id: null,
        visibility: null,
      },
    ];
    const members = [{ user_id: "user_1", role: "member", joined_at: "2026-06-01T00:00:00.000Z" }];

    return {
      DB: {
        prepare(sql) {
          return {
            bind(...args) {
              return {
                async first() {
                  if (sql.includes("FROM room_members WHERE room_id = ? AND user_id = ?")) {
                    return args[0] === "room_1" && args[1] === "user_1" ? { ok: 1 } : null;
                  }
                  if (sql.includes("SELECT id FROM rooms WHERE id = ?")) {
                    return args[0] === "room_1" ? { id: "room_1" } : null;
                  }
                  if (sql.includes("SELECT type FROM rooms")) {
                    return args[1] === "room_1" ? { id: "room_1", type: "group" } : null;
                  }
                  return null;
                },
                async all() {
                  if (sql.includes("FROM messages") && sql.includes("ORDER BY created_at DESC")) {
                    return { results: messages };
                  }
                  if (sql.includes("FROM room_members")) {
                    return { results: members };
                  }
                  return { results: [] };
                },
                async run() {
                  return { success: true, meta: { last_row_id: 99 } };
                },
              };
            },
          };
        },
      },
      RATE_LIMIT_MCP_TOOLS_PER_MINUTE: "1000",
      RATE_LIMIT_MCP_MESSAGES_PER_MINUTE: "1000",
      RATE_LIMIT_FALLBACK_ALLOW: "true",
    };
  }

  const deps = {
    env: createEnv(),
    auth,
    roomId: "room_1",
    logError: () => {},
    workerOrigin: "https://chat.example.com",
  };

  it("lists room-scoped tools", async () => {
    const result = await handleMcpRoomRequest(
      { method: "tools/list", params: {}, id: 1 },
      deps,
    );
    expect(result.result.tools).toHaveLength(MCP_ROOM_TOOLS.length);
    expect(result.result.tools.map((t) => t.name)).toEqual([
      "send_message",
      "read_timeline",
      "list_participants",
      "subscribe_events",
    ]);
  });

  it("answers server/discover without an initialize handshake", async () => {
    const result = await handleMcpRoomRequest(
      { method: "server/discover", params: {}, id: "d1" },
      deps,
    );
    expect(result.result.supportedVersions).toContain("2026-07-28");
    expect(result.result.serverInfo?.name || result.result._meta).toBeTruthy();
  });

  it("rejects guest token scoped to another room", () => {
    const scope = assertMcpRoomTokenScope(
      { roles: ["guest"], roomId: "other_room" },
      "room_1",
    );
    expect(scope.ok).toBe(false);
    expect(scope.error).toBe("token_not_valid_for_room");
  });

  it("send_message publishes to the bound room", async () => {
    const { publishMcpRoomMessage } = await import("./mcp-room-message.js");
    const result = await handleMcpRoomRequest(
      {
        method: "tools/call",
        params: { name: "send_message", arguments: { content: "Hello from MCP" } },
        id: 2,
      },
      deps,
    );
    expect(result.result.isError).toBeUndefined();
    expect(publishMcpRoomMessage).toHaveBeenCalledWith(
      deps.env,
      expect.objectContaining({ roomId: "room_1", content: "Hello from MCP" }),
    );
    const payload = JSON.parse(result.result.content[0].text);
    expect(payload.status).toBe("sent");
  });

  it("read_timeline returns messages for allowed room", async () => {
    const result = await handleMcpRoomRequest(
      {
        method: "tools/call",
        params: { name: "read_timeline", arguments: { limit: 10 } },
        id: 3,
      },
      deps,
    );
    const payload = JSON.parse(result.result.content[0].text);
    expect(payload.roomId).toBe("room_1");
    expect(payload.messages).toHaveLength(1);
  });

  it("subscribe_events returns stream URLs", async () => {
    const result = await handleMcpRoomRequest(
      {
        method: "tools/call",
        params: { name: "subscribe_events", arguments: {} },
        id: 4,
      },
      deps,
    );
    const payload = JSON.parse(result.result.content[0].text);
    expect(payload.sseUrl).toContain("/rooms/room_1/stream");
    expect(payload.websocketPath).toContain("/ws/room/room_1");
  });

  it("returns forbidden when user cannot access room", async () => {
    const result = await handleMcpRoomRequest(
      { method: "tools/list", params: {}, id: 5 },
      {
        ...deps,
        roomId: "forbidden_room",
      },
    );
    expect(result.error).toBeDefined();
    expect(result.error.message).toBe("forbidden");
  });
});
