import { describe, expect, it, vi } from "vitest";
import {
  MCP_ROOM_TOOLS,
  assertMcpRoomTokenScope,
  handleMcpRoomRequest,
} from "./mcp-room-server.js";
import { incrementOperationalMetric } from "./operational-metrics.js";

vi.mock("./operational-metrics.js", () => ({
  incrementOperationalMetric: vi.fn(async () => {}),
}));

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

  function createEnv({ sources = [], articles = [], feedback = [] } = {}) {
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
                  if (sql.includes("FROM support_knowledge_base")) {
                    return { results: articles };
                  }
                  if (sql.includes("FROM kb_doc_feedback")) {
                    return { results: feedback };
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
      RATE_LIMIT_KV: {
        get: async (key) =>
          key === "kb:sources:proj_1" && sources.length ? JSON.stringify(sources) : null,
        put: async () => {},
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

  it("lists room-scoped tools with titles and annotations", async () => {
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
    for (const tool of result.result.tools) {
      expect(tool.title).toBeTruthy();
      expect(tool.annotations).toBeTruthy();
      expect(tool.outputSchema?.type).toBe("object");
    }
  });

  it("counts handled requests into per-method mcp_requests metrics", async () => {
    incrementOperationalMetric.mockClear();
    await handleMcpRoomRequest({ method: "tools/list", params: {}, id: 9 }, deps);
    expect(incrementOperationalMetric).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        metricName: "mcp_requests.tools_list",
        projectId: "proj_1",
        value: 1,
      }),
    );
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
    expect(result.result.structuredContent).toMatchObject({ status: "sent" });
  });

  it("elicits missing message content only from capable clients", async () => {
    const headers = new Headers({
      "MCP-Protocol-Version": "2026-07-28",
      "Mcp-Method": "tools/call",
      "Mcp-Name": "send_message",
    });
    const meta = { "io.modelcontextprotocol/protocolVersion": "2026-07-28" };
    const capable = await handleMcpRoomRequest(
      {
        method: "tools/call",
        params: {
          name: "send_message",
          arguments: {},
          _meta: { ...meta, "io.modelcontextprotocol/clientCapabilities": { elicitation: {} } },
        },
        id: 5,
      },
      { ...deps, requestHeaders: headers },
    );
    expect(capable.result.resultType).toBe("input_required");
    expect(capable.result.inputRequests["elicit-1"].method).toBe("elicitation/create");

    const bare = await handleMcpRoomRequest(
      { method: "tools/call", params: { name: "send_message", arguments: {}, _meta: meta }, id: 6 },
      { ...deps, requestHeaders: headers },
    );
    expect(bare.error.code).toBe(-32021);
    expect(bare.httpStatus).toBe(400);
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
    expect(result.result.structuredContent).toEqual(payload);
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

  it("lists search_knowledge and kb sources only for admins", async () => {
    const adminDeps = {
      ...deps,
      env: createEnv({
        sources: [{ id: "kbs_1", type: "url", name: "Handbook", enabled: true }],
      }),
      auth: { ...auth, roles: ["admin"] },
    };

    const adminTools = await handleMcpRoomRequest({ method: "tools/list", params: {}, id: 11 }, adminDeps);
    const names = adminTools.result.tools.map((t) => t.name);
    expect(names).toContain("search_knowledge");
    const tool = adminTools.result.tools.find((t) => t.name === "search_knowledge");
    expect(tool.annotations).toMatchObject({ readOnlyHint: true });
    expect(tool.outputSchema.type).toBe("object");

    const memberTools = await handleMcpRoomRequest({ method: "tools/list", params: {}, id: 12 }, deps);
    expect(memberTools.result.tools.map((t) => t.name)).not.toContain("search_knowledge");

    const adminResources = await handleMcpRoomRequest(
      { method: "resources/list", params: {}, id: 13 },
      adminDeps,
    );
    expect(adminResources.result.resources).toEqual([
      expect.objectContaining({ uri: "kb_source://kbs_1", name: "Handbook", mimeType: "application/json" }),
    ]);

    const memberResources = await handleMcpRoomRequest(
      { method: "resources/list", params: {}, id: 14 },
      deps,
    );
    expect(memberResources.result.resources).toEqual([]);
  });

  it("search_knowledge applies document feedback and gates non-admins", async () => {
    const adminDeps = {
      ...deps,
      env: createEnv({
        articles: [
          {
            id: "kb_a",
            title: "Vacation policy",
            content: "25 days",
            tags: null,
            updated_at: "2026-08-10T00:00:00.000Z",
          },
          {
            id: "kb_b",
            title: "Expense policy",
            content: "Receipts",
            tags: null,
            updated_at: "2026-08-09T00:00:00.000Z",
          },
        ],
        feedback: [{ doc_id: "kb_a", verdict: "hide" }],
      }),
      auth: { ...auth, roles: ["owner"] },
    };

    const admin = await handleMcpRoomRequest(
      {
        method: "tools/call",
        params: { name: "search_knowledge", arguments: { query: "policy" } },
        id: 15,
      },
      adminDeps,
    );
    const payload = JSON.parse(admin.result.content[0].text);
    expect(payload.hits.map((h) => h.id)).toEqual(["kb_b"]);
    expect(admin.result.structuredContent).toEqual(payload);

    const member = await handleMcpRoomRequest(
      {
        method: "tools/call",
        params: { name: "search_knowledge", arguments: { query: "policy" } },
        id: 16,
      },
      deps,
    );
    expect(member.result.isError).toBe(true);
    expect(JSON.parse(member.result.content[0].text).error).toBe("forbidden");
  });

  it("reads kb_source resources as JSON for admins", async () => {
    const adminDeps = {
      ...deps,
      env: createEnv({ sources: [{ id: "kbs_1", type: "url", name: "Handbook", enabled: true }] }),
      auth: { ...auth, roles: ["admin"] },
    };
    const read = await handleMcpRoomRequest(
      { method: "resources/read", params: { uri: "kb_source://kbs_1" }, id: 17 },
      adminDeps,
    );
    expect(read.result.contents[0].mimeType).toBe("application/json");
    expect(JSON.parse(read.result.contents[0].text).name).toBe("Handbook");

    const missing = await handleMcpRoomRequest(
      { method: "resources/read", params: { uri: "kb_source://nope" }, id: 18 },
      adminDeps,
    );
    expect(missing.error.code).toBe(-32602);
  });
});
