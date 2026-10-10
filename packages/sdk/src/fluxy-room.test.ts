import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FluxyChatClient } from "./fluxy-chat-client";

type WsHandler = (event?: { code?: number; reason?: string; data?: string }) => void;

describe("FluxyChatClient.room", () => {
  let instances: Array<{ url: string; close: ReturnType<typeof vi.fn> }> = [];

  class MockWebSocket {
    static OPEN = 1;
    static CLOSED = 3;
    readyState = MockWebSocket.OPEN;
    url: string;
    sent: string[] = [];
    close = vi.fn((code?: number, reason?: string) => {
      this.readyState = MockWebSocket.CLOSED;
      this.emit("close", { code: code ?? 1000, reason: reason ?? "" });
    });
    private listeners: Record<string, WsHandler[]> = {};

    constructor(url: string) {
      this.url = url;
      instances.push(this);
      queueMicrotask(() => this.emit("open"));
    }

    addEventListener(type: string, handler: WsHandler) {
      (this.listeners[type] ||= []).push(handler);
    }

    emit(type: string, event?: { code?: number; reason?: string; data?: string }) {
      for (const handler of this.listeners[type] || []) handler(event);
    }

    send(data: string) {
      this.sent.push(data);
    }
  }

  beforeEach(() => {
    instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reuses one connection per room id and attach opens it", async () => {
    const client = new FluxyChatClient({ baseUrl: "http://127.0.0.1:8787", userId: "u", token: "jwt" });
    const a = client.connectRoom("lobby", { heartbeatIntervalMs: 0, replayHistoryOnReconnect: false });
    const bag = client.room("lobby");
    expect(bag.connection).toBe(a);
    expect(bag.roomId).toBe("lobby");
    await bag.attach();
    expect(instances).toHaveLength(1);
    expect(instances[0]!.url).toContain("protocol=1");
    expect(bag.status()).toBe("attached");
    expect(a.connectionStatus).toBe("connected");
    expect(client.connection.status).toBe("connected");
    expect(client.logger.withContext({ room: "lobby" }).error).toEqual(expect.any(Function));
    await expect(client.rooms.exists("lobby")).resolves.toBe(true);
    await expect(client.rooms.exists("")).resolves.toBe(false);
    expect(bag.options.typing.heartbeatThrottleMs).toBe(10_000);
    expect(bag.options.occupancy.enableEvents).toBe(true);
    client.dispose();
    expect(client.connection.status).toBe("closed");
  });

  it("FX-CONN-1 client.connection maps reconnecting to disconnected and close to closed", async () => {
    const client = new FluxyChatClient({ baseUrl: "http://127.0.0.1:8787", userId: "u", token: "jwt" });
    expect(client.connection.status).toBe("initialized");
    const changes: string[] = [];
    const { off } = client.connection.onStatusChange((change) => {
      changes.push(`${change.previous}->${change.current}`);
    });
    const bag = client.room("lobby", { heartbeatIntervalMs: 0, replayHistoryOnReconnect: false });
    bag.attach();
    await vi.waitFor(() => expect(client.connection.status).toBe("connected"));
    client.close();
    expect(client.connection.status).toBe("closed");
    expect(changes.some((row) => row.endsWith("->connected"))).toBe(true);
    expect(changes.some((row) => row.endsWith("->closed"))).toBe(true);
    off();
  });

  it("FX-CONN-2 client.connection.ping resolves on pong", async () => {
    const client = new FluxyChatClient({ baseUrl: "http://127.0.0.1:8787", userId: "u", token: "jwt" });
    const bag = client.room("lobby", { heartbeatIntervalMs: 0, replayHistoryOnReconnect: false });
    bag.attach();
    await vi.waitFor(() => expect(instances.length).toBe(1));
    const pending = client.connection.ping();
    (instances[0] as unknown as { emit: (type: string, event: { data: string }) => void }).emit("message", {
      data: JSON.stringify({ type: "pong" }),
    });
    await expect(pending).resolves.toBeGreaterThanOrEqual(0);
  });

  it("rooms.get reuses the bag and rooms.release closes the socket", async () => {
    const client = new FluxyChatClient({ baseUrl: "http://127.0.0.1:8787", userId: "u", token: "jwt" });
    const a = await client.rooms.get("lobby", { heartbeatIntervalMs: 0, replayHistoryOnReconnect: false });
    const b = await client.rooms.get("lobby");
    expect(client.rooms.count).toBe(1);
    expect(b.connection).toBe(a.connection);
    a.attach();
    await vi.waitFor(() => expect(instances.length).toBe(1));
    await client.rooms.release("lobby");
    expect(instances[0]!.close).toHaveBeenCalled();
    const c = await client.rooms.get("lobby", { heartbeatIntervalMs: 0, replayHistoryOnReconnect: false });
    expect(c.connection).not.toBe(a.connection);
  });

  it("FX-ROOM-1 rooms.get waits for an in-flight release", async () => {
    const client = new FluxyChatClient({ baseUrl: "http://127.0.0.1:8787", userId: "u", token: "jwt" });
    const opts = { heartbeatIntervalMs: 0, replayHistoryOnReconnect: false };
    const a = await client.rooms.get("lobby", opts);
    a.attach();
    await vi.waitFor(() => expect(instances.length).toBe(1));
    const releasing = client.rooms.release("lobby");
    const next = client.rooms.get("lobby", opts);
    await releasing;
    const b = await next;
    expect(b.connection).not.toBe(a.connection);
  });

  it("FX-ROOM-1 rooms.dispose then get throws resource_disposed", async () => {
    const client = new FluxyChatClient({ baseUrl: "http://127.0.0.1:8787", userId: "u", token: "jwt" });
    await client.rooms.get("lobby", { heartbeatIntervalMs: 0, replayHistoryOnReconnect: false });
    await client.rooms.dispose();
    await expect(client.rooms.get("lobby")).rejects.toThrow(/disposed/);
  });

  it("rooms.get during release then dispose throws resource_disposed", async () => {
    const client = new FluxyChatClient({ baseUrl: "http://127.0.0.1:8787", userId: "u", token: "jwt" });
    const opts = { heartbeatIntervalMs: 0, replayHistoryOnReconnect: false };
    await client.rooms.get("lobby", opts);
    const releasing = client.rooms.release("lobby");
    const pending = client.rooms.get("lobby", opts);
    await client.rooms.dispose();
    await releasing;
    await expect(pending).rejects.toThrow(/disposed/);
  });

  it("rooms.get rejects when the same id is requested with different options", async () => {
    const client = new FluxyChatClient({ baseUrl: "http://127.0.0.1:8787", userId: "u", token: "jwt" });
    await client.rooms.get("lobby", { heartbeatIntervalMs: 0, replayHistoryOnReconnect: false });
    await expect(
      client.rooms.get("lobby", { heartbeatIntervalMs: 1, replayHistoryOnReconnect: false }),
    ).rejects.toThrow(/options differ/);
  });

  it("close tears down every attached room", async () => {
    const client = new FluxyChatClient({ baseUrl: "http://127.0.0.1:8787", userId: "u", token: "jwt" });
    client.room("a").attach();
    client.room("b").attach();
    await vi.waitFor(() => expect(instances.length).toBe(2));
    client.close();
    expect(instances[0]!.close).toHaveBeenCalled();
    expect(instances[1]!.close).toHaveBeenCalled();
  });

  it("room.cursors.set sends a cursor frame", async () => {
    const client = new FluxyChatClient({ baseUrl: "http://127.0.0.1:8787", userId: "u", token: "jwt" });
    const bag = client.room("lobby", { heartbeatIntervalMs: 0, replayHistoryOnReconnect: false });
    bag.attach();
    await vi.waitFor(() => expect(instances.length).toBe(1));
    bag.cursors.set({ x: 12, y: 8 });
    expect(instances[0]!.sent.some((row) => row.includes('"cursor"'))).toBe(true);
    (instances[0] as unknown as { emit: (type: string, event: { data: string }) => void }).emit("message", {
      data: JSON.stringify({
        type: "cursor",
        roomId: "lobby",
        userId: "ada",
        x: 12,
        y: 8,
      }),
    });
    expect(bag.cursors.getAll().ada).toMatchObject({ userId: "ada", x: 12, y: 8 });
    expect((await bag.cursors.history()).items).toHaveLength(1);
  });

  it("FX-OBJ-1 room.objects.set sends derived_set", async () => {
    const client = new FluxyChatClient({ baseUrl: "http://127.0.0.1:8787", userId: "u", token: "jwt" });
    const bag = client.room("lobby", { heartbeatIntervalMs: 0, replayHistoryOnReconnect: false });
    bag.attach();
    await vi.waitFor(() => expect(instances.length).toBe(1));
    bag.objects.set({ checklist: ["a"] });
    expect(instances[0]!.sent.some((row) => row.includes("derived_set"))).toBe(true);
  });

  it("FX-LOCK-1 room.locks.acquire sends lock_acquire", async () => {
    const client = new FluxyChatClient({ baseUrl: "http://127.0.0.1:8787", userId: "u", token: "jwt" });
    const bag = client.room("lobby", { heartbeatIntervalMs: 0, replayHistoryOnReconnect: false });
    bag.attach();
    await vi.waitFor(() => expect(instances.length).toBe(1));
    bag.locks.acquire("slide-1");
    expect(instances[0]!.sent.some((row) => row.includes("lock_acquire"))).toBe(true);
  });

  it("FX-OCC-1 room.occupancy.subscribe receives connections and members", async () => {
    const client = new FluxyChatClient({ baseUrl: "http://127.0.0.1:8787", userId: "u", token: "jwt" });
    const bag = client.room("lobby", { heartbeatIntervalMs: 0, replayHistoryOnReconnect: false });
    const seen: Array<{ occupancy: { connections: number; presenceMembers: number } }> = [];
    const occ = bag.occupancy.subscribe((row) => seen.push(row));
    bag.attach();
    await vi.waitFor(() => expect(instances.length).toBe(1));
    (instances[0] as unknown as { emit: (type: string, event: { data: string }) => void }).emit("message", {
      data: JSON.stringify({
        type: "occupancy",
        roomId: "lobby",
        connections: 2,
        presenceMembers: 1,
      }),
    });
    expect(seen).toEqual([
      { type: "occupancy.updated", occupancy: { connections: 2, presenceMembers: 1, watching: 1 } },
    ]);
    expect(bag.occupancy.current()).toEqual({ connections: 2, presenceMembers: 1, watching: 1 });
    expect(bag.occupancy.current.connections).toBe(2);
    expect(bag.occupancy.current.presenceMembers).toBe(1);
    expect(bag.occupancy.current.watching).toBe(1);
    expect(typeof occ.unsubscribe).toBe("function");
    occ.unsubscribe();
  });

  it("FX-REAC-2 subscribeRaw throws unless messages.rawMessageReactions is true", () => {
    const client = new FluxyChatClient({ baseUrl: "http://127.0.0.1:8787", userId: "u", token: "jwt" });
    const bag = client.room("lobby", { heartbeatIntervalMs: 0, replayHistoryOnReconnect: false });
    expect(() => bag.messages.reactions.subscribeRaw(() => {})).toThrow(/raw message reactions are disabled/);
    const raw = client.room("raw-room", {
      heartbeatIntervalMs: 0,
      replayHistoryOnReconnect: false,
      messages: { rawMessageReactions: true },
    });
    expect(typeof raw.messages.reactions.subscribeRaw(() => {})).toBe("function");
  });

  it("FX-OCC-2 occupancy.enableEvents false throws feature_not_enabled and ignores frames", async () => {
    const client = new FluxyChatClient({ baseUrl: "http://127.0.0.1:8787", userId: "u", token: "jwt" });
    const bag = client.room("lobby", {
      heartbeatIntervalMs: 0,
      replayHistoryOnReconnect: false,
      occupancy: { enableEvents: false },
    });
    expect(() => bag.occupancy.subscribe(() => {})).toThrow(/occupancy events are disabled/);
    bag.attach();
    await vi.waitFor(() => expect(instances.length).toBe(1));
    (instances[0] as unknown as { emit: (type: string, event: { data: string }) => void }).emit("message", {
      data: JSON.stringify({
        type: "occupancy",
        roomId: "lobby",
        connections: 2,
        presenceMembers: 1,
      }),
    });
    expect(() => bag.occupancy.current()).toThrow(/occupancy events are disabled/);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              subscriptionCount: 3,
              userCount: 1,
              members: [{ userId: "a" }],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );
    await expect(bag.occupancy.get()).resolves.toEqual({ connections: 3, presenceMembers: 1, watching: 2 });
  });

  it("FX-TYP-1 and FX-RREAC-1 send typing and room_reaction frames", async () => {
    const client = new FluxyChatClient({ baseUrl: "http://127.0.0.1:8787", userId: "u", token: "jwt" });
    const bag = client.room("lobby", { heartbeatIntervalMs: 0, replayHistoryOnReconnect: false });
    bag.attach();
    await vi.waitFor(() => expect(instances.length).toBe(1));
    await vi.waitFor(() => expect(bag.status.current()).toBe("attached"));
    expect(bag.status()).toBe("attached");
    expect(String(bag.status)).toBe("attached");
    bag.typing.keystroke();
    bag.reactions.send("👏");
    expect(instances[0]!.sent.some((row) => row.includes('"typing"'))).toBe(true);
    expect(instances[0]!.sent.some((row) => row.includes("room_reaction"))).toBe(true);

    const seen: string[] = [];
    bag.reactions.subscribe((event) =>
      seen.push(`${event.reaction.userId}:${event.reaction.name}`),
    );
    (instances[0] as unknown as { emit: (type: string, event: { data: string }) => void }).emit("message", {
      data: JSON.stringify({
        type: "room_reaction",
        roomId: "lobby",
        userId: "ada",
        name: "👏",
      }),
    });
    expect(seen).toEqual(["ada:👏"]);
  });

  it("room.presence.enter sends presence_patch", async () => {
    const client = new FluxyChatClient({ baseUrl: "http://127.0.0.1:8787", userId: "u", token: "jwt" });
    const bag = client.room("lobby", { heartbeatIntervalMs: 0, replayHistoryOnReconnect: false });
    bag.attach();
    await vi.waitFor(() => expect(instances.length).toBe(1));
    bag.presence.enter({ uiLocation: { surface: "slide", id: "1" } });
    expect(instances[0]!.sent.some((row) => row.includes("presence_patch"))).toBe(true);
  });

  it("FX-HIST-1 room.messages.subscribe receives live message frames", async () => {
    const client = new FluxyChatClient({ baseUrl: "http://127.0.0.1:8787", userId: "u", token: "jwt" });
    const bag = client.room("lobby", { heartbeatIntervalMs: 0, replayHistoryOnReconnect: false });
    const types: string[] = [];
    let serial = "";
    bag.messages.subscribe((event) => {
      types.push(event.type);
      serial = event.message.serial ?? "";
    });
    bag.attach();
    await vi.waitFor(() => expect(instances.length).toBe(1));
    (instances[0] as unknown as { emit: (type: string, event: { data: string }) => void }).emit("message", {
      data: JSON.stringify({
        type: "message",
        id: 9,
        roomId: "lobby",
        userId: "ada",
        content: "hi",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    });
    expect(types).toEqual(["message.created"]);
    expect(serial).toBe("9");
  });

  it("FX-SEQ-1 room.onDiscontinuity receives ErrorInfo and off()", async () => {
    const client = new FluxyChatClient({ baseUrl: "http://127.0.0.1:8787", userId: "u", token: "jwt" });
    const bag = client.room("lobby", { heartbeatIntervalMs: 0, replayHistoryOnReconnect: false });
    const reasons: string[] = [];
    const sub = bag.onDiscontinuity((reason) => reasons.push(reason.message));
    bag.attach();
    await vi.waitFor(() => expect(instances.length).toBe(1));
    (instances[0] as unknown as { emit: (type: string, event: { data: string }) => void }).emit("message", {
      data: JSON.stringify({
        type: "discontinuity",
        roomId: "lobby",
        code: 10200,
        expectedSeq: 2,
        receivedSeq: 4,
      }),
    });
    expect(reasons[0]).toMatch(/unable to resume room; seq gap expected 2 received 4/);
    expect(typeof sub.off).toBe("function");
    sub.off();
  });
});
