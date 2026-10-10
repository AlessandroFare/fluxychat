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

  it("connect() builds ws url with userId + publishable key + token", () => {
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
      publishableKey: "pk_live_abc",
      token: "jwt_abc",
    });
    client.connect("room 1");

    expect(wsMock).toHaveBeenCalledTimes(1);
    const url = String(wsMock.mock.calls[0]?.[0]);
    expect(url).toContain("ws://127.0.0.1:8787/ws/room/room%201");
    expect(url).toContain("apiKey=pk_live_abc");
    expect(url).toContain("token=jwt_abc");
    expect(url).toContain("userId=alice");
  });

  it("connect() does not put fc_ secret keys on the WebSocket query string", () => {
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
      apiKey: "fc_super_secret",
      token: "jwt_abc",
    });
    client.connect("lobby");
    const url = String(wsMock.mock.calls[0]?.[0]);
    expect(url).toContain("token=jwt_abc");
    expect(url).not.toContain("fc_super_secret");
    expect(url).not.toMatch(/[?&]apiKey=fc_/);
  });

  it("connect() adds replay query params when options are set", () => {
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
      token: "jwt_abc",
    });
    client.connect("room-a", { replay: "connect", replayLimit: 80 });
    client.connect("room-b", { replay: "off" });

    const connectUrl = String(wsMock.mock.calls[0]?.[0]);
    expect(connectUrl).toContain("replay=connect");
    expect(connectUrl).toContain("replayLimit=80");

    const offUrl = String(wsMock.mock.calls[1]?.[0]);
    expect(offUrl).toContain("replay=off");
    expect(offUrl).not.toContain("replayLimit");
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

  it("createMessage() includes metadata and headers", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          message: { id: 1, roomId: "r", userId: "u", content: "c", createdAt: new Date().toISOString() },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
    await client.createMessage("room", "hello", null, undefined, undefined, {
      metadata: { color: "red" },
      headers: { source: "sdk" },
    });
    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(String(init?.body));
    expect(body.metadata).toEqual({ color: "red" });
    expect(body.headers).toEqual({ source: "sdk" });
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
    expect(messages.map((m) => m.serial)).toEqual(["1", "2"]);
  });

  it("fetchMessages() sends start/end history window", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ messages: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
    await client.fetchMessages("room", {
      start: Date.parse("2026-01-01T00:00:00.000Z"),
      end: "2026-01-31T00:00:00.000Z",
    });
    const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(calledUrl).toContain("after=");
    expect(calledUrl).toContain("end=2026-01-31");
  });

  it("FX-HIST-7 fetchMessages sends fromSerial rewind", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ messages: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
    await client.fetchMessages("room", { fromSerial: 9 });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("fromSerial=9");
  });

  it("FX-REAC-4 sendReactionRest posts type and count", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
    await client.sendReactionRest(9, "👏", "add", { type: "multiple", count: 3 });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ emoji: "👏", type: "multiple", count: 3 });
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

  it("getVapidPublicKey calls the public endpoint and returns the key", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ publicKey: "AAAA", subject: "mailto:x" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
    const r = await client.getVapidPublicKey("proj_1");
    expect(r.publicKey).toBe("AAAA");
    expect(r.subject).toBe("mailto:x");
  });

  it("registerWebPush POSTs endpoint + keys to /push/web/subscribe", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
    const sub = {
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      keys: { p256dh: "BNC", auth: "auth" },
      toJSON() {
        return { endpoint: this.endpoint, keys: this.keys };
      },
    } as unknown as PushSubscription;
    const r = await client.registerWebPush(sub, {
      projectId: "proj_1",
      userAgent: "vitest",
    });
    expect(r.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(`${baseUrl}/push/web/subscribe`);
    expect(init?.method).toBe("POST");
    const body = JSON.parse(String(init?.body));
    expect(body.endpoint).toBe("https://fcm.googleapis.com/fcm/send/abc");
    expect(body.keys.p256dh).toBe("BNC");
    expect(body.userAgent).toBe("vitest");
  });

  it("listWebPushSubscriptions returns the rows array", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          subscriptions: [
            { id: "wps_1", endpointHost: "fcm.googleapis.com", endpointPreview: "abc", userAgent: null, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", lastSentAt: null, failureCount: 0 },
          ],
        }),
        { status: 200 },
      ),
    );
    const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
    const r = await client.listWebPushSubscriptions();
    expect(r.subscriptions).toHaveLength(1);
    expect(r.subscriptions[0].endpointHost).toBe("fcm.googleapis.com");
  });

  it("getRoomLive() parses /rooms/:id/live and returns normalized snapshot", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          roomId: "lobby",
          shardCount: 1,
          occupied: true,
          subscriptionCount: 3,
          userCount: 2,
          online: 3,
          users: ["alice", "bob"],
          members: [
            { userId: "alice", userInfo: { name: "Alice", role: "owner" } },
            { userId: "bob", userInfo: { name: "Bob" } },
          ],
          socketIds: ["s1", "s2", "s3"],
          cursors: [{ type: "cursor", userId: "alice", x: 1, y: 2, ts: 9 }],
          cursorHistory: [{ type: "cursor", userId: "alice", x: 1, y: 2, ts: 9 }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
    const live = await client.getRoomLive("lobby");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(calledUrl).toBe(`${baseUrl}/rooms/lobby/live`);

    expect(live.occupied).toBe(true);
    expect(live.subscriptionCount).toBe(3);
    expect(live.online).toBe(3);
    expect(live.users).toEqual(["alice", "bob"]);
    expect(live.members).toHaveLength(2);
    expect(live.members[0]?.userId).toBe("alice");
    expect(live.members[0]?.userInfo).toEqual({ name: "Alice", role: "owner" });
    expect(live.socketIds).toEqual(["s1", "s2", "s3"]);
    expect(live.cursors[0]).toMatchObject({ userId: "alice", x: 1, y: 2 });
    expect(live.cursorHistory).toHaveLength(1);
  });

  it("getRoomLive() returns an empty snapshot for an empty roomId without calling fetch", async () => {
    const fetchMock = vi.mocked(fetch);
    const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
    const live = await client.getRoomLive("   ");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(live.users).toEqual([]);
    expect(live.members).toEqual([]);
    expect(live.occupied).toBe(false);
  });

  it("getRoomParticipants() returns only the members slice", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          roomId: "lobby",
          shardCount: 2,
          occupied: true,
          online: 5,
          users: ["alice", "bob", "agent-1"],
          members: [
            { userId: "alice", userInfo: { name: "Alice" } },
            { userId: "agent-1", userInfo: { name: "Helper", agentId: "agent-1" } },
          ],
          socketIds: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
    const members = await client.getRoomParticipants("lobby");
    expect(members).toHaveLength(2);
    expect(members[1]?.userInfo?.agentId).toBe("agent-1");
  });

  describe("sendVoiceMessage (P12-B)", () => {
    it("POSTs a multipart FormData to /messages/voice and returns the voice envelope", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            messageId: 99,
            kind: "voice",
            audioUrl: "/attachments/voice/proj/r/99.webm",
            durationMs: 4200,
            transcriptionStatus: "pending",
            createdAt: "2026-06-05T10:00:00.000Z",
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        ),
      );
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      const audio = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/webm" });
      const msg = await client.sendVoiceMessage("lobby", audio, {
        durationMs: 4200,
        clientMessageId: "cm-1",
        parentId: 12,
      });
      expect(msg).not.toBeNull();
      expect(msg?.kind).toBe("voice");
      expect(msg?.audioUrl).toBe("/attachments/voice/proj/r/99.webm");
      expect(msg?.transcriptionStatus).toBe("pending");
      expect(msg?.transcription).toBeNull();
      expect(msg?.durationMs).toBe(4200);
      expect(msg?.audioMimeType).toBe("audio/webm");
      expect(msg?.clientMessageId).toBe("cm-1");
      expect(msg?.parentId).toBe(12);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = fetchMock.mock.calls[0];
      expect(String(calledUrl)).toBe("http://127.0.0.1:8787/messages/voice");
      expect(calledInit?.method).toBe("POST");
      expect(calledInit?.body).toBeInstanceOf(FormData);
      // The Authorization header must be set
      const headers = calledInit?.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer jwt");
    });

    it("normalizes MediaRecorder mime with codec params before upload", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            messageId: 1,
            kind: "voice",
            audioUrl: "/a.webm",
            transcriptionStatus: "pending",
            createdAt: "2026-06-05T10:00:00.000Z",
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        ),
      );
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      const audio = new Blob([new Uint8Array([1])], { type: "audio/webm;codecs=opus" });
      await client.sendVoiceMessage("lobby", audio);
      const body = fetchMock.mock.calls[0]?.[1]?.body as FormData;
      const file = body.get("audio") as File;
      expect(file.type).toBe("audio/webm");
    });

    it("returns null without calling fetch when no JWT is set", async () => {
      const fetchMock = vi.mocked(fetch);
      const client = new FluxyChatClient({ baseUrl, userId: "u" });
      const audio = new Blob([new Uint8Array([1])], { type: "audio/webm" });
      const msg = await client.sendVoiceMessage("lobby", audio);
      expect(msg).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns null without calling fetch when roomId is empty", async () => {
      const fetchMock = vi.mocked(fetch);
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      const audio = new Blob([new Uint8Array([1])], { type: "audio/webm" });
      const msg = await client.sendVoiceMessage("   ", audio);
      expect(msg).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("throws when the Worker responds with a non-2xx status", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "rate_limit_exceeded" }), {
          status: 429,
          headers: { "Content-Type": "application/json", "Retry-After": "42" },
        }),
      );
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      const audio = new Blob([new Uint8Array([1])], { type: "audio/webm" });
      await expect(client.sendVoiceMessage("lobby", audio)).rejects.toThrow(/429/);
    });
  });

  describe("summarizeThread (P12-M)", () => {
    it("POSTs to /messages/:id/summary and returns summary payload", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            summary: "- Topic: refund\n- Next: email receipt",
            rootMessageId: 10,
            messageCount: 4,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      const result = await client.summarizeThread(10, "lobby");
      expect(result?.summary).toContain("refund");
      expect(result?.rootMessageId).toBe(10);
      const [calledUrl, calledInit] = fetchMock.mock.calls[0];
      expect(String(calledUrl)).toBe("http://127.0.0.1:8787/messages/10/summary");
      expect(calledInit?.method).toBe("POST");
      const body = JSON.parse(String(calledInit?.body));
      expect(body.roomId).toBe("lobby");
    });
  });

  describe("suggestReplies (P12-D)", () => {
    it("POSTs JSON to /messages/suggest-replies and returns the suggestions array", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ suggestions: ["Sounds good!", "Let me check", "Thanks!"] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      const result = await client.suggestReplies("lobby");
      expect(result).toEqual(["Sounds good!", "Let me check", "Thanks!"]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = fetchMock.mock.calls[0];
      expect(String(calledUrl)).toBe("http://127.0.0.1:8787/messages/suggest-replies");
      expect(calledInit?.method).toBe("POST");
      const headers = calledInit?.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer jwt");
      const body = JSON.parse(String(calledInit?.body));
      expect(body.roomId).toBe("lobby");
      expect(body.parentId).toBeUndefined();
    });

    it("passes parentId when provided", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ suggestions: ["OK"] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      const result = await client.suggestReplies("lobby", 42);
      expect(result).toEqual(["OK"]);
      const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
      expect(body.parentId).toBe(42);
    });

    it("returns null without calling fetch when no JWT is set", async () => {
      const fetchMock = vi.mocked(fetch);
      const client = new FluxyChatClient({ baseUrl, userId: "u" });
      const result = await client.suggestReplies("lobby");
      expect(result).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns null without calling fetch when roomId is empty", async () => {
      const fetchMock = vi.mocked(fetch);
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      const result = await client.suggestReplies("   ");
      expect(result).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns empty array when suggestions field is missing", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({}),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      const result = await client.suggestReplies("lobby");
      expect(result).toEqual([]);
    });

    it("throws when the Worker responds with a non-2xx status", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "ai_not_configured" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
      );
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      await expect(client.suggestReplies("lobby")).rejects.toThrow(/503/);
    });
  });

  describe("room export (P12-O)", () => {
    it("GET /export/rooms/:id.markdown returns blob", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        new Response("# Room export", {
          status: 200,
          headers: { "Content-Type": "text/markdown" },
        }),
      );
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      const blob = await client.exportRoomMarkdown("lobby");
      expect(blob).toBeInstanceOf(Blob);
      expect(String(fetchMock.mock.calls[0][0])).toContain("/export/rooms/lobby.markdown");
    });
  });

  describe("quiet hours (P12-N)", () => {
    it("GET /notifications/quiet-hours", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            preferences: {
              enabled: true,
              timezone: "Europe/Rome",
              quietStart: "22:00",
              quietEnd: "07:00",
              batchPush: true,
              batchInApp: true,
              updatedAt: "2026-06-08T10:00:00.000Z",
            },
            pendingBatch: 2,
            inQuietHours: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      const data = await client.getQuietHoursPreferences();
      expect(data?.pendingBatch).toBe(2);
      expect(data?.preferences.timezone).toBe("Europe/Rome");
    });
  });

  describe("digest preferences (P12-F)", () => {
    it("GET /digest/preferences", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            preferences: {
              enabled: true,
              email: "a@example.com",
              emailEnabled: true,
              webPushEnabled: true,
              inAppEnabled: true,
              updatedAt: "2026-06-08T08:00:00.000Z",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      const prefs = await client.getDigestPreferences();
      expect(prefs?.enabled).toBe(true);
      expect(prefs?.email).toBe("a@example.com");
    });
  });

  describe("searchMessages (P12-E)", () => {
    it("GET /search/messages with query param", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            query: "deploy",
            results: [{ id: 1, roomId: "r1", userId: "u1", content: "deploy now", createdAt: "x", snippet: "[[deploy]] now" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      const data = await client.searchMessages("deploy", { roomId: "r1" });
      expect(data?.results).toHaveLength(1);
      expect(String(fetchMock.mock.calls[0][0])).toContain("q=deploy");
    });
  });

  describe("getInbox (P12-C)", () => {
    it("GET /inbox returns summary", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            mentions: [],
            unreadRooms: [{ roomId: "r1", roomName: "General", unreadCount: 2 }],
            snoozedRooms: [],
            followUps: [],
            counts: { mentions: 0, unreadRooms: 1, snoozedRooms: 0, followUps: 0 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      const inbox = await client.getInbox();
      expect(inbox?.unreadRooms).toHaveLength(1);
    });
  });

  describe("support canned + CSAT", () => {
    it("lists canned responses and records use", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ responses: [{ id: "cr_1", shortcut: "hi", title: "Hi", body: "Hello" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      const rows = await client.listCannedResponses();
      expect(rows[0]?.shortcut).toBe("hi");
      await client.useCannedResponse("cr_1");
      expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/support/canned-responses/cr_1/use");
    });

    it("creates, updates, and deletes a canned response", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, id: "cr_9" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      );
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      const created = await client.createCannedResponse({
        shortcut: "bye",
        title: "Bye",
        body: "Thanks",
      });
      expect(created.id).toBe("cr_9");
      await client.updateCannedResponse("cr_9", { body: "Thank you" });
      await client.deleteCannedResponse("cr_9");
      expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe("PATCH");
      expect((fetchMock.mock.calls[2]?.[1] as RequestInit).method).toBe("DELETE");
    });

    it("loads pending CSAT and submits a rating", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ survey: { id: "sss_1", ticketId: "st_1", surveyType: "csat" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      const pending = await client.getPendingCsat("room-1");
      expect(pending?.id).toBe("sss_1");
      await client.respondCsat("sss_1", 5, "good");
      expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/support/csat/sss_1/respond");
    });
  });

  describe("fleet geofences", () => {
    it("updates, deletes, and lists geofence events", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, events: [{ id: "gfe_1", geofenceId: "gf_1", vehicleId: "v_1", eventType: "enter", occurredAt: "t" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      await client.updateFleetGeofence("gf_1", { name: "dock" });
      await client.deleteFleetGeofence("gf_1");
      const listed = await client.listFleetGeofenceEvents({ vehicleId: "v_1" });
      expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe("PATCH");
      expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe("DELETE");
      expect(String(fetchMock.mock.calls[2]?.[0])).toContain("/fleet/geofence-events");
      expect(listed.events[0]?.eventType).toBe("enter");
    });
  });

  describe("getAgentQueue (P13-T4)", () => {
    it("GET /client/feature-flags returns flags and reconnect backoff", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            flags: {
              voice_messages: true,
              reply_suggestions: false,
              embed_widget: true,
              reconnect_backoff_fluxy: true,
            },
            flagship: false,
            reconnectBackoff: { baseBackoffMs: 1000, maxBackoffMs: 8000 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      const flags = await client.getFeatureFlags();
      expect(flags.flags.reply_suggestions).toBe(false);
      expect(flags.reconnectBackoff.baseBackoffMs).toBe(1000);
    });

    it("GET /agent-queue returns tasks", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            tasks: [{ id: "t1", roomId: "r1", status: "open", slaBreached: false }],
            counts: { total: 1, open: 1, claimed: 0, slaBreached: 0 },
            slaMinutes: 15,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      const queue = await client.getAgentQueue();
      expect(queue?.tasks).toHaveLength(1);
    });
  });

  describe("chat threads", () => {
    it("listRoomThreads pages with the server nextCursor", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              threads: [{ id: 20, rootThreadId: 20, depth: 0, messageCount: 2 }],
              hasMore: true,
              nextCursor: "c_10",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              threads: [{ id: 5, rootThreadId: 5, depth: 0, messageCount: 1 }],
              hasMore: false,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      const page = await client.listRoomThreads("lobby", { limit: 1 });
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/rooms/lobby/threads");
      expect(page.nextCursor).toBe("c_10");
      const next = await page.next();
      expect(String(fetchMock.mock.calls[1]?.[0])).toContain("cursor=c_10");
      expect(next.threads[0]?.id).toBe(5);
      const done = await next.next();
      expect(done.threads).toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("createMessage throws ThreadDepthExceededError", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "thread_depth_exceeded", reason: "thread_depth_exceeded" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      );
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      const { ThreadDepthExceededError } = await import("./structured-errors");
      await expect(client.createMessage("lobby", "too deep", 99)).rejects.toBeInstanceOf(
        ThreadDepthExceededError,
      );
    });

    it("createMessage throws FluxyNotMemberError on 403 forbidden", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }),
      );
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      const { FluxyNotMemberError } = await import("./errors");
      await expect(client.createMessage("secret-room", "hi")).rejects.toBeInstanceOf(
        FluxyNotMemberError,
      );
    });

    it("createMessage throws FluxyRateLimitError on 429", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "rate_limit_exceeded" }), {
          status: 429,
          headers: { "Content-Type": "application/json", "Retry-After": "9" },
        }),
      );
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      const { FluxyRateLimitError } = await import("./structured-errors");
      try {
        await client.createMessage("lobby", "hi");
        throw new Error("expected rate limit");
      } catch (err) {
        expect(err).toBeInstanceOf(FluxyRateLimitError);
        expect((err as InstanceType<typeof FluxyRateLimitError>).retryAfterMs).toBe(9000);
      }
    });
  });

  describe("agent schedules", () => {
    it("lists room agent schedules", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, schedules: [{ id: "asch_1", agentId: "agt_1", kind: "delay", status: "pending", prompt: "wake", nextRunAt: 1 }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      const rows = await client.listAgentSchedules("lobby");
      expect(rows[0]?.id).toBe("asch_1");
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/rooms/lobby/agent-schedules");
    });

    it("posts delay schedules and deletes by id", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, created: true, schedule: { id: "asch_2", agentId: "agt_1", kind: "delay", status: "pending", nextRunAt: 9 } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      const created = await client.scheduleAgent("lobby", { agentId: "agt_1", kind: "delay", delayMs: 5000, prompt: "standup" });
      expect(created.schedule.id).toBe("asch_2");
      await client.cancelAgentSchedule("lobby", "asch_2");
      expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/rooms/lobby/agent-schedules/asch_2");
      expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe("DELETE");
    });
  });

  describe("stream overlays", () => {
    it("lists overlays for a room", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ overlays: [{ id: "o1", name: "Chat", overlayType: "chat", roomId: "live" }], count: 1 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      const rows = await client.listStreamOverlays("live");
      expect(rows[0]?.overlayType).toBe("chat");
      expect(client.streamOverlayWidgetUrl("o1")).toContain("/overlays/o1/widget");
    });

    it("gets and patches overlay visibility", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "o1", name: "Chat", overlayType: "chat", roomId: "live", enabled: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "o1", name: "Chat", overlayType: "chat", enabled: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      const got = await client.getStreamOverlay("o1");
      expect(got.enabled).toBe(true);
      const patched = await client.updateStreamOverlay("o1", { enabled: false, style: { opacity: 0.4 } });
      expect(patched.enabled).toBe(false);
      expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe("PATCH");
    });
  });

  describe("edu breakouts", () => {
    it("joins a breakout and ends all", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, memberCount: 1 }), { status: 200 }));
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, closed: ["brk_1"] }), { status: 200 }));
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      await client.joinBreakout("class-1", "brk_1");
      await client.endAllBreakouts("class-1");
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/breakouts/brk_1/join");
      expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/breakouts/end-all");
    });

    it("votes a typed poll and activates the room timer", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, timer: { mode: "timer", running: false, timeMs: 60000 } }), { status: 200 }),
      );
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      await client.voteTypedPoll("poll_1", "Blue");
      await client.activateRoomTimer("class-1", { mode: "timer", timeMs: 60_000 });
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/polls/poll_1/vote");
      expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/rooms/class-1/timer/activate");
    });
  });

  describe("workflows", () => {
    it("dispatches a Botpress-style event", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, runs: [] }), { status: 200 }),
      );
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      await client.dispatchWorkflowEvent("message_received", { role: "vip" });
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/workflows/events");
    });

    it("stops a workflow execution", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, status: "cancelled" }), { status: 200 }),
      );
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      await client.stopWorkflowExecution("wfe_1");
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/workflows/executions/wfe_1/stop");
    });

    it("posts a production workflow webhook without JWT", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, runs: [] }), { status: 200 }),
      );
      const client = new FluxyChatClient({ baseUrl, userId: "u" });
      await client.ingestWorkflowWebhook("hookpath1", { method: "POST", body: { ping: 1 } });
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/hooks/workflows/hookpath1");
    });

    it("reads workflow state", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, value: { n: 1 } }), { status: 200 }),
      );
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      await client.getWorkflowState("user", "u1", "step");
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/workflows/state");
    });
  });

  describe("voice token", () => {
    it("mints a member-scoped LiveKit token", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, token: { provider: "livekit", stub: true } }), { status: 200 }),
      );
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      await client.getVoiceToken("lobby", { canPublish: false });
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/rooms/lobby/voice/token");
    });
  });

  describe("invokeAgentRest", () => {
    it("throws without a JWT", async () => {
      const client = new FluxyChatClient({ baseUrl, userId: "u" });
      await expect(client.invokeAgentRest("bot-1", "lobby", "hi")).rejects.toThrow(/JWT/);
    });

    it("maps 429 to FluxyRateLimitError", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "agent_rate_limit_exceeded" }), {
          status: 429,
          headers: { "Content-Type": "application/json", "Retry-After": "5" },
        }),
      );
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      const { FluxyRateLimitError } = await import("./structured-errors");
      try {
        await client.invokeAgentRest("bot-1", "lobby", "hi");
        throw new Error("expected rate limit");
      } catch (err) {
        expect(err).toBeInstanceOf(FluxyRateLimitError);
        expect((err as InstanceType<typeof FluxyRateLimitError>).retryAfterMs).toBe(5000);
      }
    });

    it("maps 404 to AGENT_NOT_FOUND", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "agent not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
      );
      const client = new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" });
      const { ChatError } = await import("./structured-errors");
      try {
        await client.invokeAgentRest("missing", "lobby", "hi");
        throw new Error("expected agent not found");
      } catch (err) {
        expect(err).toBeInstanceOf(ChatError);
        expect((err as InstanceType<typeof ChatError>).code).toBe("AGENT_NOT_FOUND");
      }
    });
  });
});

