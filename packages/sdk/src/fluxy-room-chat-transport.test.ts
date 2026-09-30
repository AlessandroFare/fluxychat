import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { FluxyChatClient } from "./fluxy-chat-client";
import { FluxyRoomChatTransport, lastUserText } from "./fluxy-room-chat-transport";

describe("FluxyRoomChatTransport", () => {
  const baseUrl = "https://worker.example";

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the last user text from parts or content", () => {
    expect(lastUserText([{ role: "assistant", content: "hi" }, { role: "user", content: "ping" }])).toBe(
      "ping",
    );
    expect(
      lastUserText([{ role: "user", parts: [{ type: "text", text: "from parts" }] }]),
    ).toBe("from parts");
  });

  it("sendMessages invokes the room agent and streams the reply as UI chunks", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            run: { id: "run_1", status: "completed", createdAt: "2026-01-01T00:00:00.000Z" },
            message: { id: 9, content: "pong", userId: "bot-1", createdAt: "2026-01-01T00:00:00.000Z" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ approvals: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
    const transport = new FluxyRoomChatTransport({ client, roomId: "deal", agentId: "bot-1" });
    const stream = await transport.sendMessages({
      messages: [{ role: "user", content: "hello" }],
    });
    const chunks = [];
    const reader = stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    expect(chunks.some((c) => c.type === "text-delta" && c.delta === "pong")).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init?.body)).content).toBe("hello");
  });

  it("reconnectToStream returns null when no active stream", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ approvals: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ streams: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
    const transport = new FluxyRoomChatTransport({ client, roomId: "deal", agentId: "bot-1" });
    expect(await transport.reconnectToStream({ chatId: "deal" })).toBeNull();
  });

  it("reconnectToStream replays persisted content", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ approvals: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ streams: [{ streamId: "s1", active: true }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ streamId: "s1", content: "partial", active: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
    const transport = new FluxyRoomChatTransport({ client, roomId: "deal", agentId: "bot-1" });
    const stream = await transport.reconnectToStream({ chatId: "x" });
    expect(stream).not.toBeNull();
    const chunks = [];
    const reader = stream!.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    expect(chunks.some((c) => c.type === "text-delta" && c.delta === "partial")).toBe(true);
  });

  it("maps addToolApprovalResponse onto HITL decide", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ approvals: [] }), { status: 200 }));
    const { lastToolApprovalResponse } = await import("./fluxy-room-chat-transport");
    expect(
      lastToolApprovalResponse([
        {
          role: "assistant",
          parts: [{ type: "tool-approval-response", approvalId: "appr_1", approved: true, signature: "sig" }],
        },
      ])?.approvalId,
    ).toBe("appr_1");
    const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
    const transport = new FluxyRoomChatTransport({ client, roomId: "deal", agentId: "bot-1" });
    await transport.sendMessages({
      messages: [
        {
          role: "user",
          parts: [{ type: "tool-approval-response", approvalId: "appr_1", approved: true }],
        },
      ],
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/hitl/approvals/appr_1/approve");
  });
});
