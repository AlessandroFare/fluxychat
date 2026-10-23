import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchSupportRoutingRoutes } from "./support-routing-http.js";

vi.mock("../lib/support-routing.js", () => ({
  suggestMessageRouting: vi.fn(),
}));

import { suggestMessageRouting } from "../lib/support-routing.js";

function makeHandler(overrides = {}) {
  return {
    env: { DB: {} },
    json: (body, init = {}) =>
      new Response(JSON.stringify(body), {
        status: init.status || 200,
        headers: { "content-type": "application/json", ...(init.headers || {}) },
      }),
    corsHeaders: {},
    requestLogCtx: {},
    verifyJwtAndGetContext: async () => ({ projectId: "p1", userId: "u1", roles: ["member"] }),
    canAccessRoom: async () => true,
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
  return dispatchSupportRoutingRoutes(request, new URL(request.url), handler);
}

beforeEach(() => {
  vi.clearAllMocks();
  suggestMessageRouting.mockResolvedValue({ suggested: true, queue: "support" });
});

describe("support routing routes", () => {
  it("returns null for non-matching paths or methods", async () => {
    const handler = makeHandler();
    expect(await call(handler, "GET", "/rooms/r1/routing/suggest")).toBeNull();
    expect(await call(handler, "POST", "/rooms/r1/routing/other")).toBeNull();
  });

  it("returns 401 without a JWT", async () => {
    const handler = makeHandler({ verifyJwtAndGetContext: async () => null });
    const res = await call(handler, "POST", "/rooms/r1/routing/suggest", { content: "help" });
    expect(res.status).toBe(401);
  });

  it("returns 403 when the room is outside the project", async () => {
    const handler = makeHandler({ canAccessRoom: async () => false });
    const res = await call(handler, "POST", "/rooms/r1/routing/suggest", { content: "help" });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden" });
  });

  it("suggests routing with the request content and sender", async () => {
    const res = await call(makeHandler(), "POST", "/rooms/r1/routing/suggest", {
      content: "I need a refund",
      senderUserId: "u2",
    });
    expect(res.status).toBe(200);
    expect(suggestMessageRouting).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      roomId: "r1",
      messageContent: "I need a refund",
      senderUserId: "u2",
    });
  });

  it("defaults the sender to the authenticated user", async () => {
    await call(makeHandler(), "POST", "/rooms/r1/routing/suggest", {});
    expect(suggestMessageRouting).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ messageContent: "", senderUserId: "u1" }),
    );
  });

  it("returns 500 and logs when routing throws", async () => {
    const logError = vi.fn();
    suggestMessageRouting.mockRejectedValue(new Error("boom"));
    const res = await call(makeHandler({ logError }), "POST", "/rooms/r1/routing/suggest", { content: "help" });
    expect(res.status).toBe(500);
    expect(logError).toHaveBeenCalledWith("support_routing.unhandled", expect.any(Error), {});
  });
});
