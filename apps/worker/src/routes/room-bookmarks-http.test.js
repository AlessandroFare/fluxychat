import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthMatrixDeps } from "./auth-matrix-deps.js";
import { dispatchRoomBookmarksRoutes } from "./room-bookmarks-http.js";
import * as lib from "../lib/room-bookmarks.js";

vi.mock("../lib/room-bookmarks.js", () => ({
  listRoomBookmarks: vi.fn(async () => ({ bookmarks: [{ id: "b1", label: "Docs" }] })),
  createRoomBookmark: vi.fn(async () => ({ ok: true, bookmark: { id: "b1", label: "Docs" } })),
  deleteRoomBookmark: vi.fn(async () => ({ ok: true })),
}));

function deps({ roles = ["member"], extra = {} } = {}) {
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
  return dispatchRoomBookmarksRoutes(
    new Request(`http://127.0.0.1:8787${path}`, init),
    new URL(`http://127.0.0.1:8787${path}`),
    h,
  );
}

describe("room bookmark routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("401s without a JWT", async () => {
    const res = await request("/rooms/room_1/bookmarks", {}, createAuthMatrixDeps());
    expect(res.status).toBe(401);
  });

  it("403s when the room is not accessible", async () => {
    const res = await request(
      "/rooms/room_1/bookmarks",
      {},
      deps({ extra: { canAccessRoom: async () => false } }),
    );
    expect(res.status).toBe(403);
  });

  it("400s on an invalid room id", async () => {
    const res = await request("/rooms/bad%20room/bookmarks", {}, deps());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_room");
  });

  it("GET lists and POST creates", async () => {
    const listed = await request("/rooms/room_1/bookmarks", {}, deps());
    expect(listed.status).toBe(200);
    expect((await listed.json()).bookmarks).toEqual([{ id: "b1", label: "Docs" }]);
    expect(lib.listRoomBookmarks).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      roomId: "room_1",
    });

    lib.createRoomBookmark.mockResolvedValueOnce({ ok: false, error: "invalid_bookmark_url" });
    const bad = await request(
      "/rooms/room_1/bookmarks",
      { method: "POST", body: { label: "Docs", url: "nope" } },
      deps(),
    );
    expect(bad.status).toBe(400);

    const created = await request(
      "/rooms/room_1/bookmarks",
      { method: "POST", body: { label: "Docs", url: "https://docs.example.com" } },
      deps(),
    );
    expect(created.status).toBe(201);
    expect(lib.createRoomBookmark).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      roomId: "room_1",
      label: "Docs",
      url: "https://docs.example.com",
      createdBy: "user_bob",
    });
  });

  it("DELETE grants privileged deletes to admins and 403s when the lib refuses", async () => {
    lib.deleteRoomBookmark.mockResolvedValueOnce({ ok: false, error: "forbidden", status: 403 });
    const denied = await request("/rooms/room_1/bookmarks/b1", { method: "DELETE" }, deps());
    expect(denied.status).toBe(403);
    expect(lib.deleteRoomBookmark).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      roomId: "room_1",
      id: "b1",
      actorUserId: "user_bob",
      privileged: false,
    });

    const admin = await request(
      "/rooms/room_1/bookmarks/b1",
      { method: "DELETE" },
      deps({ roles: ["admin"] }),
    );
    expect(admin.status).toBe(200);
    expect(lib.deleteRoomBookmark).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ privileged: true }),
    );
  });
});
