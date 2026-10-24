import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthMatrixDeps } from "./auth-matrix-deps.js";
import { dispatchCustomEmojisRoutes } from "./custom-emojis-http.js";
import * as lib from "../lib/custom-emoji.js";

vi.mock("../lib/custom-emoji.js", () => ({
  createCustomEmoji: vi.fn(async () => ({ ok: true, emoji: { id: "e1", name: "parrot" } })),
  deleteCustomEmoji: vi.fn(async () => ({ ok: true })),
  listCustomEmojis: vi.fn(async () => ({ emojis: [{ id: "e1", name: "parrot" }] })),
}));

function deps({ roles = ["owner"], extra = {} } = {}) {
  return createAuthMatrixDeps({
    verifyJwt: async () => ({ userId: "user_bob", projectId: "p1", roles }),
    extra,
  });
}

function request(path, { method = "GET", body } = {}, h) {
  const init = { method, headers: {} };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return dispatchCustomEmojisRoutes(
    new Request(`http://127.0.0.1:8787${path}`, init),
    new URL(`http://127.0.0.1:8787${path}`),
    h,
  );
}

describe("custom emoji routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("401s without a JWT", async () => {
    const res = await request("/custom-emojis", {}, createAuthMatrixDeps());
    expect(res.status).toBe(401);
  });

  it("GET lists the project emoji", async () => {
    const res = await request("/custom-emojis", {}, deps());
    expect(res.status).toBe(200);
    expect((await res.json()).emojis).toEqual([{ id: "e1", name: "parrot" }]);
    expect(lib.listCustomEmojis).toHaveBeenCalledWith(expect.anything(), { projectId: "p1" });
  });

  it("POST requires an admin role and forwards the payload", async () => {
    const denied = await request(
      "/custom-emojis",
      { method: "POST", body: { name: "parrot", imageUrl: "https://x/p.png" } },
      deps({ roles: ["member"] }),
    );
    expect(denied.status).toBe(403);
    expect(lib.createCustomEmoji).not.toHaveBeenCalled();

    const created = await request(
      "/custom-emojis",
      { method: "POST", body: { name: "parrot", imageUrl: "https://x/p.png" } },
      deps(),
    );
    expect(created.status).toBe(201);
    expect(lib.createCustomEmoji).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      name: "parrot",
      imageUrl: "https://x/p.png",
      createdBy: "user_bob",
    });
  });

  it("POST surfaces a lib validation error as 400", async () => {
    lib.createCustomEmoji.mockResolvedValueOnce({ ok: false, error: "invalid_emoji_name" });
    const res = await request("/custom-emojis", { method: "POST", body: { name: "!" } }, deps());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_emoji_name");
  });

  it("DELETE decodes the id and 404s on unknown emoji", async () => {
    lib.deleteCustomEmoji.mockResolvedValueOnce({ ok: false, error: "emoji_not_found", status: 404 });
    const missing = await request("/custom-emojis/emoji%201", { method: "DELETE" }, deps());
    expect(missing.status).toBe(404);
    expect(lib.deleteCustomEmoji).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      id: "emoji 1",
    });
  });
});
