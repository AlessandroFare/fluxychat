import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthMatrixDeps } from "./auth-matrix-deps.js";
import { dispatchSavedMessagesRoutes } from "./saved-messages-http.js";
import * as lib from "../lib/saved-messages.js";

vi.mock("../lib/saved-messages.js", () => ({
  listSavedMessages: vi.fn(async () => ({ items: [{ messageId: 7, roomId: "r1" }] })),
}));

function deps(overrides = {}) {
  return createAuthMatrixDeps({
    verifyJwt: async () => ({ userId: "user_bob", projectId: "p1" }),
    ...overrides,
  });
}

function request(path, { method = "GET" } = {}, h) {
  return dispatchSavedMessagesRoutes(
    new Request(`http://127.0.0.1:8787${path}`, { method }),
    new URL(`http://127.0.0.1:8787${path}`),
    h,
  );
}

describe("saved messages routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("401s without a JWT", async () => {
    const res = await request("/saved-messages", {}, createAuthMatrixDeps());
    expect(res.status).toBe(401);
  });

  it("GET returns the hidden list items scoped to the user", async () => {
    const res = await request("/saved-messages?limit=10", {}, deps());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([{ messageId: 7, roomId: "r1" }]);
    expect(body.count).toBe(1);
    expect(lib.listSavedMessages).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      userId: "user_bob",
      limit: "10",
    });
  });

  it("ignores calls on unrelated paths", async () => {
    const res = await request("/not-saved", {}, deps());
    expect(res).toBeNull();
  });
});
