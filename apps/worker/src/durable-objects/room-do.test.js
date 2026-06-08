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
    });

    const connectReq = new Request(
      `https://worker/ws/room/${roomId}?replay=connect&historyLimit=120`
    );
    expect(parseWsConnectOptions(connectReq)).toEqual({
      replay: "connect",
      limit: 120,
      cache: false,
    });

    const cacheReq = new Request(
      `https://worker/ws/room/${roomId}?cache=1&replay=off`
    );
    expect(parseWsConnectOptions(cacheReq)).toMatchObject({
      replay: "off",
      cache: true,
    });
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
});
