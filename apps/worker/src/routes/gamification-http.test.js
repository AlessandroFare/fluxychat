import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchGamificationRoutes } from "./gamification-http.js";

vi.mock("../lib/gamification.js", () => ({
  initDefaultBadges: vi.fn(),
  awardXP: vi.fn(),
  getUserProfile: vi.fn(),
  getLeaderboard: vi.fn(),
  listBadges: vi.fn(),
}));

import {
  awardXP,
  getLeaderboard,
  getUserProfile,
  initDefaultBadges,
  listBadges,
} from "../lib/gamification.js";

function makeHandler(overrides = {}) {
  return {
    env: { DB: {} },
    json: (body, init = {}) =>
      new Response(JSON.stringify(body), {
        status: init.status || 200,
        headers: { "content-type": "application/json" },
      }),
    corsHeaders: {},
    verifyJwtAndGetContext: async () => ({ projectId: "p1", userId: "u1", roles: ["member"] }),
    ...overrides,
  };
}

async function call(handler, method, path, body) {
  const request = new Request(`https://worker.test${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return dispatchGamificationRoutes(request, new URL(request.url), handler);
}

beforeEach(() => {
  vi.clearAllMocks();
  initDefaultBadges.mockResolvedValue({ created: 5 });
  awardXP.mockResolvedValue({ ok: true, xp: 10 });
  getUserProfile.mockResolvedValue({ userId: "u2", xp: 10 });
  getLeaderboard.mockResolvedValue({ entries: [] });
  listBadges.mockResolvedValue({ badges: [] });
});

describe("gamification routes", () => {
  it("answers CORS preflight before auth", async () => {
    const res = await call(makeHandler({ verifyJwtAndGetContext: async () => null }), "OPTIONS", "/gamification/award");
    expect(res.status).toBe(204);
  });

  it("returns 401 without a JWT", async () => {
    const handler = makeHandler({ verifyJwtAndGetContext: async () => null });
    const res = await call(handler, "POST", "/gamification/award", { userId: "u2" });
    expect(res.status).toBe(401);
  });

  it("returns null for an unknown path once authenticated", async () => {
    const res = await call(makeHandler(), "GET", "/gamification/unknown");
    expect(res).toBeNull();
  });

  it("initializes badges for the authenticated project", async () => {
    const res = await call(makeHandler(), "POST", "/gamification/init");
    expect(res.status).toBe(200);
    expect(initDefaultBadges).toHaveBeenCalledWith(expect.anything(), { projectId: "p1" });
  });

  it("awards XP with the project from the token", async () => {
    const res = await call(makeHandler(), "POST", "/gamification/award", {
      userId: "u2",
      roomId: "r1",
      source: "message",
      referenceId: "m1",
    });
    expect(res.status).toBe(200);
    expect(awardXP).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      userId: "u2",
      roomId: "r1",
      source: "message",
      referenceId: "m1",
    });
  });

  it("returns 400 when the award is rejected", async () => {
    awardXP.mockResolvedValue({ ok: false, error: "duplicate" });
    const res = await call(makeHandler(), "POST", "/gamification/award", { userId: "u2" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "duplicate" });
  });

  it("reads a profile scoped to the project", async () => {
    const res = await call(makeHandler(), "GET", "/gamification/profile/u2");
    expect(res.status).toBe(200);
    expect(getUserProfile).toHaveBeenCalledWith(expect.anything(), { projectId: "p1", userId: "u2" });
  });

  it("parses leaderboard filters and defaults the limit to 50", async () => {
    const handler = makeHandler();
    await call(handler, "GET", "/gamification/leaderboard?roomId=r1&limit=10");
    expect(getLeaderboard).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      roomId: "r1",
      limit: 10,
    });

    await call(handler, "GET", "/gamification/leaderboard");
    expect(getLeaderboard).toHaveBeenLastCalledWith(expect.anything(), {
      projectId: "p1",
      roomId: null,
      limit: 50,
    });
  });

  it("lists badges for the project", async () => {
    const res = await call(makeHandler(), "GET", "/gamification/badges");
    expect(res.status).toBe(200);
    expect(listBadges).toHaveBeenCalledWith(expect.anything(), { projectId: "p1" });
  });
});
