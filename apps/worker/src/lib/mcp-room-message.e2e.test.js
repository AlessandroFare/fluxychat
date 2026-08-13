import { describe, expect, it, vi, beforeEach } from "vitest";

const fanoutMock = vi.hoisted(() => vi.fn(async () => {}));

vi.mock("./room-access.js", () => ({
  canAccessRoom: vi.fn(async () => true),
}));

vi.mock("./room-post-policy.js", () => ({
  assertCanPostToRoom: vi.fn(async () => ({ ok: true })),
}));

vi.mock("./fluxy-config-runtime.js", () => ({
  runFluxyRoomAuthz: vi.fn(async () => ({ action: "allow", capabilities: {} })),
  runFluxyPublishPipeline: vi.fn(async (_room, _auth, content) => ({
    ok: true,
    content,
  })),
}));

vi.mock("./message-middleware.js", () => ({
  runInboundMessageMiddleware: vi.fn(async ({ content }) => ({
    ok: true,
    content,
  })),
}));

vi.mock("./rate-limit.js", () => ({
  checkAndConsumeRateLimit: vi.fn(async () => ({ allowed: true })),
}));

vi.mock("./message-visibility.js", () => ({
  resolveMessageVisibility: vi.fn(() => ({
    ok: true,
    visibility: "room",
    visibleTo: [],
  })),
  resolveVisibilityRecipientUserIds: vi.fn(async () => null),
}));

vi.mock("./room-shard.js", () => ({
  fanoutRoomInternal: fanoutMock,
}));

describe("mcp-room-message E2E smoke (PH-100)", () => {
  beforeEach(() => {
    fanoutMock.mockClear();
  });

  it("publish fans out message to room WebSocket path", async () => {
    const { publishMcpRoomMessage } = await import("./mcp-room-message.js");

    const env = {
      RATE_LIMIT_FALLBACK_ALLOW: "true",
      DB: {
        prepare(sql) {
          return {
            bind(...args) {
              return {
                async first() {
                  if (sql.includes("client_message_id = ?")) return null;
                  return null;
                },
                async run() {
                  if (sql.includes("INSERT INTO messages")) {
                    return { meta: { last_row_id: 501 } };
                  }
                  return { meta: { changes: 1 } };
                },
              };
            },
          };
        },
      },
    };

    const result = await publishMcpRoomMessage(env, {
      auth: { projectId: "proj_1", userId: "agent_ext", roles: ["member"] },
      roomId: "room_support",
      content: "Hello from external MCP client",
      clientMessageId: "ext_smoke_1",
    });

    expect(result).toMatchObject({
      ok: true,
      message: {
        id: 501,
        roomId: "room_support",
        content: "Hello from external MCP client",
        clientMessageId: "ext_smoke_1",
      },
    });
    expect(fanoutMock).toHaveBeenCalledOnce();
    const init = fanoutMock.mock.calls[0][4];
    const payload = JSON.parse(String(init.body));
    expect(payload).toMatchObject({
      content: "Hello from external MCP client",
      userId: "agent_ext",
      id: 501,
      roomId: "room_support",
    });
  });
});
