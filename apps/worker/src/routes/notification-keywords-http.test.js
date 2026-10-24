import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthMatrixDeps } from "./auth-matrix-deps.js";
import { dispatchNotificationKeywordsRoutes } from "./notification-keywords-http.js";
import * as lib from "../lib/notification-keywords.js";

vi.mock("../lib/notification-keywords.js", () => ({
  listNotificationKeywords: vi.fn(async () => ({ keywords: [{ word: "deploy" }] })),
  addNotificationKeyword: vi.fn(async () => ({ ok: true, keyword: "deploy" })),
  removeNotificationKeyword: vi.fn(async () => ({ ok: true, keyword: "deploy now" })),
}));

function deps() {
  return createAuthMatrixDeps({
    verifyJwt: async () => ({ userId: "user_bob", projectId: "p1", roles: ["member"] }),
  });
}

function request(path, { method = "GET", body } = {}, h) {
  const init = { method, headers: {} };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return dispatchNotificationKeywordsRoutes(
    new Request(`http://127.0.0.1:8787${path}`, init),
    new URL(`http://127.0.0.1:8787${path}`),
    h,
  );
}

describe("notification keyword routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("401s without a JWT", async () => {
    const res = await request("/notification-keywords", {}, createAuthMatrixDeps());
    expect(res.status).toBe(401);
  });

  it("GET lists the user's keywords", async () => {
    const res = await request("/notification-keywords", {}, deps());
    expect(res.status).toBe(200);
    expect((await res.json()).keywords).toEqual([{ word: "deploy" }]);
    expect(lib.listNotificationKeywords).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      userId: "user_bob",
    });
  });

  it("POST 400s on an empty word", async () => {
    lib.addNotificationKeyword.mockResolvedValueOnce({ ok: false, error: "invalid_keyword" });
    const res = await request("/notification-keywords", { method: "POST", body: { word: "" } }, deps());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_keyword");
  });

  it("DELETE decodes the keyword", async () => {
    const res = await request("/notification-keywords/deploy%20now", { method: "DELETE" }, deps());
    expect(res.status).toBe(200);
    expect(lib.removeNotificationKeyword).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      userId: "user_bob",
      word: "deploy now",
    });
  });
});
