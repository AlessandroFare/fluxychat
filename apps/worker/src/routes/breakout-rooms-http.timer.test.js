import { describe, expect, it, vi } from "vitest";
import { dispatchBreakoutRoomsRoutes } from "./breakout-rooms-http.js";
import { activateRoomTimer } from "../lib/edu-timer.js";

vi.mock("../lib/room-access.js", () => ({
  canAccessRoom: vi.fn(async () => true),
}));
vi.mock("../lib/edu-timer.js", () => ({
  activateRoomTimer: vi.fn(async () => ({ ok: true })),
  getRoomTimer: vi.fn(async () => ({ ok: true, timer: {} })),
  resetRoomTimer: vi.fn(async () => ({ ok: true })),
  setRoomTimerMode: vi.fn(async () => ({ ok: true })),
  setRoomTimerTime: vi.fn(async () => ({ ok: true })),
  startRoomTimer: vi.fn(async () => ({ ok: true })),
  stopRoomTimer: vi.fn(async () => ({ ok: true })),
}));
vi.mock("../lib/breakout-rooms.js", () => ({
  parseBreakoutInput: () => ({ ok: true, name: "x" }),
  createBreakout: async () => ({ ok: true }),
  listBreakouts: async () => ({ ok: true, breakouts: [] }),
  closeBreakout: async () => ({ ok: true }),
  joinBreakout: async () => ({ ok: true }),
  moveBreakoutUser: async () => ({ ok: true }),
  endAllBreakouts: async () => ({ ok: true }),
  setBreakoutTime: async () => ({ ok: true }),
  broadcastToBreakouts: async () => ({ ok: true }),
}));

function deps() {
  return {
    env: {},
    json: (body, init = {}) =>
      new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { "Content-Type": "application/json" },
      }),
    corsHeaders: {},
    requestLogCtx: {},
    verifyJwtAndGetContext: async () => ({
      projectId: "proj_own",
      userId: "u_1",
      roles: ["member"],
    }),
    logError: () => {},
  };
}

describe("POST /rooms/:id/timer/:action identity pinning (A2-4)", () => {
  it("A2-4: the body cannot retarget project/room/user away from the checked path", async () => {
    const target = "https://worker.example/rooms/room_mine/timer/activate";
    const request = new Request(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "proj_victim",
        roomId: "room_victim",
        userId: "u_victim",
        timeMs: 5000,
      }),
    });
    const res = await dispatchBreakoutRoomsRoutes(request, new URL(target), deps());
    expect(res.status).toBe(200);
    expect(activateRoomTimer).toHaveBeenCalledTimes(1);
    expect(activateRoomTimer.mock.calls[0][1]).toMatchObject({
      projectId: "proj_own",
      roomId: "room_mine",
      userId: "u_1",
      timeMs: 5000,
    });
  });
});
