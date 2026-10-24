import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchOverlayRoutes } from "./streaming-overlays-http.js";

vi.mock("../lib/streaming-overlays.js", () => ({
  createOverlay: vi.fn(),
  getOverlay: vi.fn(),
  listOverlays: vi.fn(),
  deleteOverlay: vi.fn(),
  getOverlayWidget: vi.fn(),
  parseOverlayPatch: vi.fn(),
  updateOverlay: vi.fn(),
}));

import {
  createOverlay,
  deleteOverlay,
  getOverlay,
  getOverlayWidget,
  listOverlays,
  parseOverlayPatch,
  updateOverlay,
} from "../lib/streaming-overlays.js";

function makeHandler(roles = ["member"], overrides = {}) {
  return {
    env: { DB: {} },
    json: (body, init = {}) =>
      new Response(JSON.stringify(body), {
        status: init.status || 200,
        headers: { "content-type": "application/json", ...(init.headers || {}) },
      }),
    corsHeaders: {},
    requestLogCtx: {},
    verifyJwtAndGetContext: async () => ({ projectId: "p1", userId: "u1", roles }),
    hasAnyRole: (roles, allowed) => Array.isArray(roles) && roles.some((role) => allowed.includes(role)),
    logError: vi.fn(),
    ...overrides,
  };
}

async function call(handler, method, path, body) {
  const request = new Request(`https://worker.test${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return dispatchOverlayRoutes(request, new URL(request.url), handler);
}

beforeEach(() => {
  vi.clearAllMocks();
  createOverlay.mockResolvedValue({ id: "ov-1", name: "Poll" });
  getOverlay.mockResolvedValue(null);
  listOverlays.mockResolvedValue([]);
  deleteOverlay.mockResolvedValue(true);
  getOverlayWidget.mockResolvedValue(null);
  parseOverlayPatch.mockReturnValue({ ok: true, data: { name: "Poll" } });
  updateOverlay.mockResolvedValue({ ok: true, overlay: { id: "ov-1", name: "Poll" } });
});

describe("streaming overlay routes", () => {
  it("returns 401 without a JWT", async () => {
    const handler = makeHandler(["member"], { verifyJwtAndGetContext: async () => null });
    const res = await call(handler, "GET", "/overlays");
    expect(res.status).toBe(401);
  });

  it("requires owner/admin to create an overlay", async () => {
    const res = await call(makeHandler(["member"]), "POST", "/overlays", {
      name: "Poll",
      roomId: "r1",
    });
    expect(res.status).toBe(401);
    expect(createOverlay).not.toHaveBeenCalled();
  });

  it("rejects create without name and roomId", async () => {
    const res = await call(makeHandler(["owner"]), "POST", "/overlays", { name: "Poll" });
    expect(res.status).toBe(400);
  });

  it("creates an overlay scoped to the project", async () => {
    const res = await call(makeHandler(["admin"]), "POST", "/overlays", {
      name: "Poll",
      roomId: "r1",
      overlayType: "poll",
      config: { question: "Ship it?" },
    });
    expect(res.status).toBe(201);
    expect(createOverlay).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      roomId: "r1",
      name: "Poll",
      overlayType: "poll",
      config: { question: "Ship it?" },
      style: undefined,
      refreshSeconds: undefined,
    });
  });

  it("lets any member list overlays, filtered by room", async () => {
    const res = await call(makeHandler(["member"]), "GET", "/overlays?roomId=r1");
    expect(res.status).toBe(200);
    expect(listOverlays).toHaveBeenCalledWith(expect.anything(), { projectId: "p1", roomId: "r1" });
  });

  it("returns 404 for a missing overlay", async () => {
    const res = await call(makeHandler(["member"]), "GET", "/overlays/ov-1");
    expect(res.status).toBe(404);
    expect(getOverlay).toHaveBeenCalledWith(expect.anything(), { projectId: "p1", overlayId: "ov-1" });
  });

  it("rejects an invalid patch", async () => {
    parseOverlayPatch.mockReturnValue({ ok: false, error: "nothing_to_update" });
    const res = await call(makeHandler(["owner"]), "PATCH", "/overlays/ov-1", {});
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "nothing_to_update" });
  });

  it("maps update failures to their status", async () => {
    updateOverlay.mockResolvedValue({ ok: false, error: "not_found", status: 404 });
    const res = await call(makeHandler(["owner"]), "PATCH", "/overlays/ov-1", { name: "New" });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  it("updates and deletes an overlay", async () => {
    const handler = makeHandler(["admin"]);
    const patch = await call(handler, "PATCH", "/overlays/ov-1", { name: "Poll" });
    expect(patch.status).toBe(200);
    expect(updateOverlay).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      overlayId: "ov-1",
      data: { name: "Poll" },
    });

    const del = await call(handler, "DELETE", "/overlays/ov-1");
    expect(del.status).toBe(200);
    expect(await del.json()).toEqual({ ok: true });
    expect(deleteOverlay).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      overlayId: "ov-1",
    });
  });

  it("serves the public widget without auth and 404s when absent", async () => {
    const handler = makeHandler(["member"], { verifyJwtAndGetContext: async () => null });
    const res = await call(handler, "GET", "/overlays/ov-1/widget");
    expect(res.status).toBe(404);
    expect(getOverlayWidget).toHaveBeenCalledWith(expect.anything(), { overlayId: "ov-1" });
  });

  it("returns null for unrelated paths", async () => {
    expect(await call(makeHandler(), "GET", "/overlays-other")).toBeNull();
  });
});
