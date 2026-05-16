import { describe, it, expect, vi, beforeEach } from "vitest";
import { RoomDurableObject } from "./room-do.js";
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
});
