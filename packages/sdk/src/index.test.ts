import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { FluxyChatClient } from "./index";
import { File } from "node:buffer";

describe("FluxyChatClient", () => {
  const baseUrl = "http://127.0.0.1:8787";

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("connect() builds ws url with userId + apiKey/token", () => {
    const wsMock = vi.fn();
    vi.stubGlobal(
      "WebSocket",
      function WebSocket(url: string) {
        wsMock(url);
        // @ts-expect-error minimal mock
        this.readyState = 1;
      } as unknown as typeof WebSocket
    );

    const client = new FluxyChatClient({
      baseUrl,
      userId: "alice",
      apiKey: "fc_123",
      token: "jwt_abc",
    });
    client.connect("room 1");

    expect(wsMock).toHaveBeenCalledTimes(1);
    const url = String(wsMock.mock.calls[0]?.[0]);
    expect(url).toContain("ws://127.0.0.1:8787/ws/room/room%201");
    expect(url).toContain("apiKey=fc_123");
    expect(url).toContain("token=jwt_abc");
    expect(url).toContain("userId=alice");
  });

  it("createMessage() includes attachments in JSON body", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ message: { id: 1, roomId: "r", userId: "u", content: "c", createdAt: new Date().toISOString() } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const client = new FluxyChatClient({
      baseUrl,
      userId: "u",
      token: "jwt",
    });

    await client.createMessage("room", "hello", null, [
      { kind: "file", url: "https://cdn.example/a.pdf", name: "a.pdf", sizeBytes: 10, contentType: "application/pdf" },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(String(init?.body));
    expect(body.attachments).toHaveLength(1);
    expect(body.attachments[0].url).toContain("cdn.example");
  });

  it("fetchMessages() sends before cursor and returns chronological order", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          messages: [
            { id: 2, roomId: "r", userId: "u", content: "b", createdAt: "2026-01-02T00:00:00.000Z" },
            { id: 1, roomId: "r", userId: "u", content: "a", createdAt: "2026-01-01T00:00:00.000Z" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
    const messages = await client.fetchMessages("room", {
      limit: 25,
      before: "2026-01-03T00:00:00.000Z",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(calledUrl).toContain("before=2026-01-03");
    expect(calledUrl).toContain("limit=25");
    expect(messages.map((m) => m.id)).toEqual([1, 2]);
  });

  it("fetchRoomMembers() normalizes user_id to userId", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          members: [{ user_id: "alice", role: "owner", joined_at: "2026-01-01T00:00:00.000Z" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
    const members = await client.fetchRoomMembers("room-1");
    expect(members[0]?.userId).toBe("alice");
    expect(members[0]?.role).toBe("owner");
  });

  it("uploadFile() sends bytes and required headers", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          file: {
            url: "http://127.0.0.1:8787/attachments/k",
            name: "voice.webm",
            size: 3,
            contentType: "audio/webm",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
    const file = new File([new Uint8Array([1, 2, 3])], "voice.webm", { type: "audio/webm" });

    const att = await client.uploadFile("room-x", file);

    expect(att.url).toContain("/attachments/");
    expect(att.kind).toBe("audio");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(`${baseUrl}/upload`);
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer jwt");
    expect(headers["X-File-Name"]).toBe("voice.webm");
    expect(headers["X-Room-Id"]).toBe("room-x");
    expect(headers["Content-Type"]).toBe("audio/webm");
  });
});

