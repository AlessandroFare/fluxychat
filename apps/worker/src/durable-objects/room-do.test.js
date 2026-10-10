import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  RoomDurableObject,
  parseWsConnectOptions,
  MAX_WS_HISTORY_LIMIT,
} from "./room-do.js";
import * as projectPlanQuota from "../lib/project-plan-quota.js";

const projectId = "proj_room_do_quota";
const userId = "user_room_do_quota";
const roomId = "room_room_do_quota";

function createMockWebSocket() {
  const sent = [];
  return {
    sent,
    accept() {},
    addEventListener() {},
    send(data) {
      sent.push(typeof data === "string" ? data : String(data));
    },
  };
}

function createRoomDo(envOverrides = {}) {
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(..._args) {
            return {
              run: async () => ({ meta: { last_row_id: 99 } }),
              first: async () => null,
              all: async () => ({ results: [] }),
            };
          },
        };
      },
    },
    RATE_LIMIT_WS_MESSAGES_PER_MINUTE: "60",
    OG_PREVIEW_ENABLED: "false",
    ...envOverrides,
  };
  const state = { id: { toString: () => roomId } };
  const roomDo = new RoomDurableObject(state, env);
  roomDo.projectId = projectId;
  roomDo.roomId = roomId;
  return { roomDo, env };
}

describe("RoomDurableObject message handlers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("FX-OCC-1 broadcasts occupancy with connections and unique members", async () => {
    const { roomDo } = createRoomDo();
    const a = createMockWebSocket();
    const b = createMockWebSocket();
    roomDo.clients.add(a);
    roomDo.clients.add(b);
    roomDo.userIds.set(a, userId);
    roomDo.userIds.set(b, userId);

    await roomDo.broadcastSubscriptionCount();

    const occupancy = a.sent.map((row) => JSON.parse(row)).find((row) => row.type === "occupancy");
    expect(occupancy).toMatchObject({
      type: "occupancy",
      connections: 2,
      presenceMembers: 1,
      watching: 1,
    });
  });

  it("fans out live cursor frames without echoing to the sender", async () => {
    const { roomDo } = createRoomDo();
    const sender = createMockWebSocket();
    const peer = createMockWebSocket();
    roomDo.clients.add(sender);
    roomDo.clients.add(peer);
    roomDo.userIds.set(sender, userId);
    roomDo.userIds.set(peer, "user_peer");

    await roomDo.onMessage(sender, {
      data: JSON.stringify({ type: "cursor", x: 12.5, y: 80, label: "Ada" }),
    });

    expect(sender.sent).toHaveLength(0);
    expect(peer.sent).toHaveLength(1);
    expect(JSON.parse(peer.sent[0])).toMatchObject({
      type: "cursor",
      userId,
      x: 12.5,
      y: 80,
      label: "Ada",
    });
  });

  it("FX-CUR-6 stores last cursor and replays it on snapshot", async () => {
    const { roomDo } = createRoomDo();
    const sender = createMockWebSocket();
    roomDo.clients.add(sender);
    roomDo.userIds.set(sender, userId);

    await roomDo.onMessage(sender, {
      data: JSON.stringify({ type: "cursor", x: 3, y: 4, label: "Ada" }),
    });

    expect(sender.sent).toHaveLength(0);
    expect(roomDo.lastCursors.get(userId)).toMatchObject({ x: 3, y: 4, userId });
    expect(roomDo.cursorHistory.at(-1)).toMatchObject({ x: 3, y: 4, userId });
    const joiner = createMockWebSocket();
    roomDo.sendCursorSnapshot(joiner);
    expect(JSON.parse(joiner.sent[0])).toMatchObject({
      type: "cursor",
      x: 3,
      y: 4,
      snapshot: true,
    });
  });

  it("does not fan out cursors when nobody else is in the room", async () => {
    const { roomDo } = createRoomDo();
    const sender = createMockWebSocket();
    roomDo.clients.add(sender);
    roomDo.userIds.set(sender, userId);

    await roomDo.onMessage(sender, {
      data: JSON.stringify({ type: "cursor", x: 1, y: 2 }),
    });

    expect(sender.sent).toHaveLength(0);
  });

  it("fans out cursor batches with positions", async () => {
    const { roomDo } = createRoomDo();
    const sender = createMockWebSocket();
    const peer = createMockWebSocket();
    roomDo.clients.add(sender);
    roomDo.clients.add(peer);
    roomDo.userIds.set(sender, userId);
    roomDo.userIds.set(peer, "user_peer");

    await roomDo.onMessage(sender, {
      data: JSON.stringify({
        type: "cursor",
        x: 8,
        y: 9,
        positions: [
          { x: 1, y: 1, offsetMs: 0 },
          { x: 8, y: 9, offsetMs: 40 },
        ],
      }),
    });

    expect(JSON.parse(peer.sent[0])).toMatchObject({
      type: "cursor",
      x: 8,
      y: 9,
      positions: [
        { x: 1, y: 1, offsetMs: 0 },
        { x: 8, y: 9, offsetMs: 40 },
      ],
    });
  });

  it("fans out presence_patch selections without echoing to the sender", async () => {
    const { roomDo } = createRoomDo();
    const sender = createMockWebSocket();
    const peer = createMockWebSocket();
    roomDo.clients.add(sender);
    roomDo.clients.add(peer);
    roomDo.userIds.set(sender, userId);
    roomDo.userIds.set(peer, "user_peer");

    await roomDo.onMessage(sender, {
      data: JSON.stringify({
        type: "presence_patch",
        data: { selection: { x: 10, y: 20, x2: 40, y2: 80, text: "hi" } },
      }),
    });

    expect(sender.sent).toHaveLength(0);
    expect(JSON.parse(peer.sent[0])).toMatchObject({
      type: "presence_patch",
      userId,
      data: { selection: { x: 10, y: 20, x2: 40, y2: 80, text: "hi" } },
    });
  });

  it("rejects unknown client event types", async () => {
    const { roomDo } = createRoomDo();
    const ws = createMockWebSocket();
    roomDo.clients.add(ws);
    roomDo.userIds.set(ws, userId);

    await roomDo.onMessage(ws, {
      data: JSON.stringify({ type: "subscribe", channel: "room" }),
    });

    expect(ws.sent).toHaveLength(1);
    expect(JSON.parse(ws.sent[0])).toMatchObject({
      type: "error",
      message: "unknown_event_type",
    });
  });

  it("persists ws rate-limit buckets to DO storage (P0-3)", async () => {
    const storage = new Map();
    const { roomDo } = createRoomDo();
    roomDo.state = {
      storage: {
        get: async (k) => storage.get(k),
        put: async (k, v) => storage.set(k, v),
        delete: async (k) => storage.delete(k),
        setAlarm: async () => {},
        getAlarm: async () => null,
        deleteAlarm: async () => {},
      },
    };

    roomDo.consumeWsRateLimit("ws-msg:test", 2, 60_000);
    roomDo.consumeWsRateLimit("ws-msg:test", 2, 60_000);
    await roomDo.persistEphemeralToStorage();

    const { roomDo: roomDo2 } = createRoomDo();
    roomDo2.state = roomDo.state;
    roomDo2.wsRateLimitStore = new Map();
    await roomDo2.loadEphemeralFromStorage();

    const blocked = roomDo2.consumeWsRateLimit("ws-msg:test", 2, 60_000);
    expect(blocked.allowed).toBe(false);
  });

  it("fans out valid location updates and enforces track ownership", async () => {
    const { roomDo } = createRoomDo();
    const owner = createMockWebSocket();
    const viewer = createMockWebSocket();
    roomDo.clients.add(owner);
    roomDo.clients.add(viewer);
    roomDo.userIds.set(owner, userId);
    roomDo.userIds.set(viewer, "viewer");

    await roomDo.onMessage(owner, {
      data: JSON.stringify({
        type: "location_update",
        trackId: "trip-42",
        latitude: 45.4642,
        longitude: 9.19,
        accuracy: 7,
      }),
    });

    expect(roomDo.locationTracks.get("trip-42")).toMatchObject({ userId, roomId });
    expect(JSON.parse(viewer.sent.at(-1))).toMatchObject({
      type: "location_update",
      trackId: "trip-42",
      userId,
    });

    await roomDo.onMessage(viewer, {
      data: JSON.stringify({ type: "location_track_ended", trackId: "trip-42" }),
    });
    expect(JSON.parse(viewer.sent.at(-1))).toMatchObject({
      type: "error",
      message: "location_track_forbidden",
    });
  });

  it("sends only fresh location tracks in a connect snapshot", () => {
    const { roomDo } = createRoomDo();
    const ws = createMockWebSocket();
    roomDo.locationTracks.set("fresh", {
      trackId: "fresh",
      roomId,
      userId,
      latitude: 1,
      longitude: 2,
      updatedAt: new Date().toISOString(),
      staleAt: new Date(Date.now() + 30_000).toISOString(),
    });
    roomDo.locationTracks.set("stale", {
      trackId: "stale",
      roomId,
      userId,
      latitude: 1,
      longitude: 2,
      updatedAt: new Date(Date.now() - 60_000).toISOString(),
      staleAt: new Date(Date.now() - 30_000).toISOString(),
    });

    roomDo.sendLocationSnapshot(ws);

    expect(JSON.parse(ws.sent[0])).toMatchObject({
      type: "location_snapshot",
      tracks: [expect.objectContaining({ trackId: "fresh" })],
    });
  });

  it("returns quota_exceeded on WS message when messages_created quota is denied", async () => {
    vi.spyOn(projectPlanQuota, "checkAndConsumeProjectQuota").mockResolvedValue({
      allowed: false,
      metricName: "messages_created",
      limit: 100,
      used: 100,
      monthKey: "2026-05",
    });

    const { roomDo } = createRoomDo();
    const ws = createMockWebSocket();
    roomDo.clients.add(ws);
    roomDo.userIds.set(ws, userId);

    await roomDo.onMessage(ws, {
      data: JSON.stringify({
        type: "message",
        userId,
        content: "hello quota",
      }),
    });

    const err = ws.sent.map((s) => JSON.parse(s)).find((p) => p.type === "error");
    expect(err).toMatchObject({
      type: "error",
      message: "quota_exceeded",
    });
    expect(err.details).toMatchObject({
      metric: "messages_created",
      limit: 100,
      used: 100,
      resetsAt: expect.any(String),
      retryAfterSeconds: expect.any(Number),
    });
    expect(projectPlanQuota.checkAndConsumeProjectQuota).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        projectId,
        metricName: "messages_created",
        amount: 1,
      })
    );
  });

  it("processStreamOp start allows empty content for agent streaming", async () => {
    vi.spyOn(projectPlanQuota, "checkAndConsumeProjectQuota").mockResolvedValue({
      allowed: true,
    });

    const { roomDo } = createRoomDo();
    const result = await roomDo.processStreamOp({
      projectId,
      roomId,
      userId,
      op: "start",
      content: "",
      parentId: null,
    });

    expect(result).toMatchObject({ ok: true, id: 99 });
    expect(roomDo.activeStreams.get(userId)).toMatchObject({
      messageId: 99,
      offset: 0,
      content: "",
    });
  });

  it("keeps stream buffer so offset resume can send a suffix", async () => {
    vi.spyOn(projectPlanQuota, "checkAndConsumeProjectQuota").mockResolvedValue({
      allowed: true,
    });
    const { roomDo } = createRoomDo();
    await roomDo.processStreamOp({
      projectId,
      roomId,
      userId,
      op: "start",
      content: "hel",
      parentId: null,
    });
    await roomDo.processStreamOp({
      projectId,
      roomId,
      userId,
      op: "delta",
      messageId: 99,
      content: "hello world",
    });
    const ws = createMockWebSocket();
    await roomDo.sendActiveStreamState(ws, {
      projectId,
      roomId,
      streamOffsets: { 99: 6 },
    });
    const payload = JSON.parse(ws.sent[0]);
    expect(payload.type).toBe("streamState");
    expect(payload.content).toBe("world");
    expect(payload.resumeFrom).toBe(6);
  });

  it("processStreamOp stop finalizes without deleting the message", async () => {
    vi.spyOn(projectPlanQuota, "checkAndConsumeProjectQuota").mockResolvedValue({
      allowed: true,
    });
    const { roomDo } = createRoomDo();
    await roomDo.processStreamOp({
      projectId,
      roomId,
      userId,
      op: "start",
      content: "hel",
      parentId: null,
    });
    const stopped = await roomDo.processStreamOp({
      projectId,
      roomId,
      userId,
      op: "stop",
    });
    expect(stopped).toMatchObject({ ok: true, id: 99 });
    expect(roomDo.activeStreams.has(userId)).toBe(false);
  });

  it("echoes requestId on stream start", async () => {
    vi.spyOn(projectPlanQuota, "checkAndConsumeProjectQuota").mockResolvedValue({
      allowed: true,
    });
    const { roomDo } = createRoomDo();
    const started = await roomDo.processStreamOp({
      projectId,
      roomId,
      userId,
      op: "start",
      content: "hel",
      parentId: null,
      requestId: "turn-9",
    });
    expect(started).toMatchObject({ ok: true, requestId: "turn-9" });
    expect(roomDo.activeStreams.get(userId).requestId).toBe("turn-9");
  });

  it("lets another member abort the only active stream", async () => {
    vi.spyOn(projectPlanQuota, "checkAndConsumeProjectQuota").mockResolvedValue({
      allowed: true,
    });
    const { roomDo } = createRoomDo();
    await roomDo.processStreamOp({
      projectId,
      roomId,
      userId,
      op: "start",
      content: "hel",
      parentId: null,
    });
    const peer = createMockWebSocket();
    roomDo.clients.add(peer);
    roomDo.userIds.set(peer, "user_peer");

    await roomDo.onMessage(peer, {
      data: JSON.stringify({ type: "stream", op: "abort" }),
    });

    expect(roomDo.activeStreams.has(userId)).toBe(false);
    expect(peer.sent.some((row) => JSON.parse(row).type === "delete")).toBe(true);
  });

  it("processStreamOp start returns quota_exceeded when quota is denied", async () => {
    vi.spyOn(projectPlanQuota, "checkAndConsumeProjectQuota").mockResolvedValue({
      allowed: false,
      metricName: "messages_created",
      limit: 50,
      used: 50,
      monthKey: "2026-05",
    });

    const { roomDo } = createRoomDo();
    const result = await roomDo.processStreamOp({
      projectId,
      roomId,
      userId,
      op: "start",
      content: "stream hello",
      parentId: null,
    });

    expect(result).toMatchObject({
      ok: false,
      error: "quota_exceeded",
      details: expect.objectContaining({
        allowed: false,
        metricName: "messages_created",
      }),
    });
  });

  it("parseWsConnectOptions respects replay off and caps replayLimit", () => {
    const req = new Request(
      `https://worker/ws/room/${roomId}?replay=off&replayLimit=9999`
    );
    expect(parseWsConnectOptions(req)).toEqual({
      replay: "off",
      limit: MAX_WS_HISTORY_LIMIT,
      cache: false,
      readonly: false,
      protocol: null,
    });

    const connectReq = new Request(
      `https://worker/ws/room/${roomId}?replay=connect&historyLimit=120`
    );
    expect(parseWsConnectOptions(connectReq)).toEqual({
      replay: "connect",
      limit: 120,
      cache: false,
      readonly: false,
      protocol: null,
    });

    const cacheReq = new Request(
      `https://worker/ws/room/${roomId}?cache=1&replay=off`
    );
    expect(parseWsConnectOptions(cacheReq)).toMatchObject({
      replay: "off",
      cache: true,
    });

    const spectatorReq = new Request(
      `https://worker/ws/room/${roomId}?readonly=1&replay=off`,
    );
    expect(parseWsConnectOptions(spectatorReq)).toMatchObject({
      replay: "off",
      readonly: true,
    });

    expect(
      parseWsConnectOptions(
        new Request(`https://worker/ws/room/${roomId}?protocol=2&replay=off`),
      ).protocol,
    ).toBe(2);
  });

  it("rejects mutating frames on a readonly socket", async () => {
    const { roomDo } = createRoomDo();
    const ws = createMockWebSocket();
    roomDo.clients.add(ws);
    roomDo.sessions.write(ws, { u: userId, ro: 1 });

    await roomDo.onMessage(ws, {
      data: JSON.stringify({ type: "message", content: "nope", userId }),
    });
    expect(JSON.parse(ws.sent[0])).toMatchObject({
      type: "error",
      message: "readonly_connection",
    });

    ws.sent.length = 0;
    await roomDo.onMessage(ws, { data: JSON.stringify({ type: "ping" }) });
    expect(JSON.parse(ws.sent[0])).toMatchObject({ type: "pong" });
  });

  it("pruneEphemeralState removes expired ws and moderation cache entries", () => {
    const { roomDo } = createRoomDo();
    const now = Date.now();
    roomDo.wsRateLimitStore.set("old", { count: 1, expiresAt: now - 1 });
    roomDo.wsRateLimitStore.set("fresh", { count: 1, expiresAt: now + 60_000 });
    roomDo.moderationCache.set("mod:old", {
      state: { muted: false, banned: false },
      expires: now - 1,
    });

    roomDo.pruneEphemeralState();

    expect(roomDo.wsRateLimitStore.has("old")).toBe(false);
    expect(roomDo.wsRateLimitStore.has("fresh")).toBe(true);
    expect(roomDo.moderationCache.has("mod:old")).toBe(false);
  });

  it("broadcast excludes connection by excludeSocketId", async () => {
    const { roomDo } = createRoomDo();
    const ws1 = createMockWebSocket();
    const ws2 = createMockWebSocket();
    roomDo.clients.add(ws1);
    roomDo.clients.add(ws2);
    roomDo.socketIds.set(ws1, "socket-a");
    roomDo.socketIds.set(ws2, "socket-b");

    await roomDo.broadcast(
      { type: "message", id: 1, roomId, userId: "u1", content: "hi" },
      { excludeSocketId: "socket-a" },
    );

    expect(ws1.sent).toHaveLength(0);
    expect(ws2.sent).toHaveLength(1);
    expect(JSON.parse(ws2.sent[0])).toMatchObject({ type: "message", id: 1 });
  });

  it("broadcast delivers the same chat frame to two sockets in the room", async () => {
    const { roomDo } = createRoomDo();
    const alice = createMockWebSocket();
    const bob = createMockWebSocket();
    roomDo.clients.add(alice);
    roomDo.clients.add(bob);

    await roomDo.broadcast({ type: "message", id: 7, roomId, userId: "alice", content: "hello" });

    expect(JSON.parse(alice.sent[0])).toMatchObject({ type: "message", id: 7, content: "hello" });
    expect(JSON.parse(bob.sent[0])).toMatchObject({ type: "message", id: 7, content: "hello" });
  });

  it("persistLastCacheEvent stores cacheable messages", async () => {
    const storage = new Map();
    const { roomDo } = createRoomDo();
    roomDo.state = {
      storage: {
        put: async (k, v) => storage.set(k, v),
        get: async (k) => storage.get(k),
      },
    };

    await roomDo.persistLastCacheEvent({
      type: "message",
      id: 42,
      roomId,
      userId: "u",
      content: "cached",
    });

    expect(roomDo.lastCacheEntry?.event).toMatchObject({ id: 42, content: "cached" });
    expect(storage.has("lastCacheEvent")).toBe(true);
  });

  it("consumeWsRateLimit blocks after limit within window", () => {
    const { roomDo } = createRoomDo();
    const key = "ws-msg:test";
    const first = roomDo.consumeWsRateLimit(key, 2, 60_000);
    const second = roomDo.consumeWsRateLimit(key, 2, 60_000);
    const third = roomDo.consumeWsRateLimit(key, 2, 60_000);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("/announce broadcasts message_updated as a patch event (P12-B UI)", async () => {
    const { roomDo } = createRoomDo();
    const ws = createMockWebSocket();
    roomDo.clients.add(ws);
    roomDo.socketIds.set(ws, "socket-x");

    const req = new Request("https://internal/announce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "message_updated",
        roomId,
        id: 99,
        kind: "voice",
        transcription: "hello there",
        transcriptionStatus: "done",
        transcriptionModel: "whisper-1",
      }),
    });

    const res = await roomDo.fetch(req);
    expect(res.status).toBe(200);

    expect(ws.sent).toHaveLength(1);
    const payload = JSON.parse(ws.sent[0]);
    expect(payload).toMatchObject({
      type: "message_updated",
      id: 99,
      roomId,
      kind: "voice",
      transcription: "hello there",
      transcriptionStatus: "done",
      transcriptionModel: "whisper-1",
    });
  });

  it("/announce broadcasts message_updated with failed transcription (P12-B UI)", async () => {
    const { roomDo } = createRoomDo();
    const ws = createMockWebSocket();
    roomDo.clients.add(ws);
    roomDo.socketIds.set(ws, "socket-y");

    const req = new Request("https://internal/announce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "message_updated",
        roomId,
        id: 7,
        kind: "voice",
        transcription: null,
        transcriptionStatus: "failed",
      }),
    });

    const res = await roomDo.fetch(req);
    expect(res.status).toBe(200);

    expect(ws.sent).toHaveLength(1);
    const payload = JSON.parse(ws.sent[0]);
    expect(payload).toMatchObject({
      type: "message_updated",
      id: 7,
      kind: "voice",
      transcription: null,
      transcriptionStatus: "failed",
    });
  });

  it("persists delay agent schedules with idempotent upsert", async () => {
    const bag = new Map();
    const { roomDo } = createRoomDo();
    roomDo.state = {
      id: { toString: () => roomId },
      storage: {
        get: async (k) => bag.get(k),
        put: async (k, v) => bag.set(k, v),
        setAlarm: async () => {},
        deleteAlarm: async () => {},
        getAlarm: async () => null,
      },
    };
    const req = (body) =>
      new Request("https://internal/agent-schedules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    const first = await (await roomDo.fetch(req({
      kind: "delay",
      agentId: "bot-1",
      delayMs: 5000,
      prompt: "ping",
      idempotencyKey: "k1",
    }))).json();
    expect(first.created).toBe(true);
    const second = await (await roomDo.fetch(req({
      kind: "delay",
      agentId: "bot-1",
      delayMs: 9000,
      idempotencyKey: "k1",
    }))).json();
    expect(second.created).toBe(false);
    expect(second.schedule.id).toBe(first.schedule.id);
  });

  it("answers typed internal RPC ping", async () => {
    const { roomDo } = createRoomDo();
    const res = await roomDo.fetch(
      new Request("https://internal/rpc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method: "ping" }),
      }),
    );
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.roomId).toBe(roomId);
  });

  it("nudges the agent DO through room RPC", async () => {
    const { roomDo } = createRoomDo({
      AGENT: {
        idFromName: (name) => name,
        get: () => ({
          fetch: async (_url, init) => {
            const body = JSON.parse(init.body);
            expect(body.method).toBe("turn");
            return new Response(JSON.stringify({ ok: true, run: { status: "completed" } }));
          },
        }),
      },
    });
    const res = await roomDo.fetch(
      new Request("https://internal/rpc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          method: "copilot_nudge",
          params: { agentId: "bot-1", userId, content: "summarize this room" },
        }),
      }),
    );
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.run.status).toBe("completed");
  });

  it("FX-LOCK-1 grants exclusive locks and denies a second holder", async () => {
    const { roomDo } = createRoomDo();
    const ada = createMockWebSocket();
    const bob = createMockWebSocket();
    roomDo.clients.add(ada);
    roomDo.clients.add(bob);
    roomDo.userIds.set(ada, userId);
    roomDo.userIds.set(bob, "user_bob");

    await roomDo.onMessage(ada, {
      data: JSON.stringify({
        type: "lock_acquire",
        lockId: "slide-1",
        attributes: { component: "slide-1" },
      }),
    });
    expect(JSON.parse(ada.sent[0])).toMatchObject({
      type: "lock",
      lockId: "slide-1",
      owner: userId,
      held: true,
      acquired: true,
      attributes: { component: "slide-1" },
    });
    expect(JSON.parse(bob.sent[0])).toMatchObject({ lockId: "slide-1", acquired: true });

    await roomDo.onMessage(bob, {
      data: JSON.stringify({ type: "lock_acquire", lockId: "slide-1" }),
    });
    expect(JSON.parse(bob.sent[1])).toMatchObject({
      type: "lock",
      owner: userId,
      acquired: false,
      held: true,
    });
  });

  it("FX-RREAC-1 fans out ephemeral room_reaction without persistence", async () => {
    const { roomDo } = createRoomDo();
    const ada = createMockWebSocket();
    const bob = createMockWebSocket();
    roomDo.clients.add(ada);
    roomDo.clients.add(bob);
    roomDo.userIds.set(ada, userId);
    roomDo.userIds.set(bob, "user_bob");

    await roomDo.onMessage(ada, {
      data: JSON.stringify({ type: "room_reaction", name: "👏" }),
    });
    expect(JSON.parse(ada.sent[0])).toMatchObject({
      type: "room_reaction",
      userId,
      name: "👏",
    });
    expect(JSON.parse(bob.sent[0])).toMatchObject({
      type: "room_reaction",
      userId,
      name: "👏",
    });
  });

  it("FX-PRES-1 presence_leave drops occupancy members without closing the socket", async () => {
    const { roomDo } = createRoomDo();
    const ada = createMockWebSocket();
    const bob = createMockWebSocket();
    roomDo.clients.add(ada);
    roomDo.clients.add(bob);
    roomDo.userIds.set(ada, userId);
    roomDo.userIds.set(bob, "user_bob");

    await roomDo.onMessage(ada, {
      data: JSON.stringify({ type: "presence_leave", data: { agentStatus: "offline" } }),
    });
    expect(JSON.parse(bob.sent.find((row) => row.includes("member_left")))).toMatchObject({
      type: "member_left",
      userId,
      data: { agentStatus: "offline" },
    });
    expect(roomDo.clients.has(ada)).toBe(true);
    expect(roomDo.occupancyPresenceUserIds()).toEqual(["user_bob"]);
  });
});
