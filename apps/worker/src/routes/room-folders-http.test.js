import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthMatrixDeps } from "./auth-matrix-deps.js";
import { dispatchRoomFoldersRoutes } from "./room-folders-http.js";
import * as lib from "../lib/room-folders.js";

vi.mock("../lib/room-folders.js", () => ({
  listRoomFolders: vi.fn(async () => ({ folders: [{ id: "f1", name: "Work", roomIds: [] }] })),
  createRoomFolder: vi.fn(async () => ({ ok: true, folder: { id: "f1", name: "Work" } })),
  renameRoomFolder: vi.fn(async () => ({ ok: true, folder: { id: "f1", name: "Renamed" } })),
  deleteRoomFolder: vi.fn(async () => ({ ok: true })),
  setRoomFolderItem: vi.fn(async () => ({ ok: true, folderId: "f1", roomId: "r1" })),
  removeRoomFolderItem: vi.fn(async () => ({ ok: true })),
}));

function deps(extra = {}) {
  return createAuthMatrixDeps({
    verifyJwt: async () => ({ userId: "user_bob", projectId: "p1", roles: ["member"] }),
    extra,
  });
}

function request(path, { method = "GET", body } = {}, h) {
  const init = { method, headers: {} };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return dispatchRoomFoldersRoutes(
    new Request(`http://127.0.0.1:8787${path}`, init),
    new URL(`http://127.0.0.1:8787${path}`),
    h,
  );
}

describe("room folder routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("401s without a JWT", async () => {
    const res = await request("/room-folders", {}, createAuthMatrixDeps());
    expect(res.status).toBe(401);
  });

  it("GET lists the user's folders", async () => {
    const res = await request("/room-folders", {}, deps());
    expect(res.status).toBe(200);
    expect((await res.json()).folders).toEqual([{ id: "f1", name: "Work", roomIds: [] }]);
    expect(lib.listRoomFolders).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      userId: "user_bob",
    });
  });

  it("POST creates and PATCH renames", async () => {
    const created = await request("/room-folders", { method: "POST", body: { name: "Work" } }, deps());
    expect(created.status).toBe(201);
    expect(lib.createRoomFolder).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      userId: "user_bob",
      name: "Work",
    });

    lib.renameRoomFolder.mockResolvedValueOnce({ ok: false, error: "folder_not_found", status: 404 });
    const missing = await request("/room-folders/gone", { method: "PATCH", body: { name: "x" } }, deps());
    expect(missing.status).toBe(404);
  });

  it("DELETE removes a folder", async () => {
    const res = await request("/room-folders/f1", { method: "DELETE" }, deps());
    expect(res.status).toBe(200);
    expect(lib.deleteRoomFolder).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      userId: "user_bob",
      folderId: "f1",
    });
  });

  it("room membership routes move and remove rooms", async () => {
    const moved = await request("/room-folders/f1/rooms", { method: "POST", body: { roomId: "r1" } }, deps());
    expect(moved.status).toBe(200);
    expect(lib.setRoomFolderItem).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      userId: "user_bob",
      folderId: "f1",
      roomId: "r1",
    });

    const removed = await request("/room-folders/f1/rooms/r1", { method: "DELETE" }, deps());
    expect(removed.status).toBe(200);
    expect(lib.removeRoomFolderItem).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      userId: "user_bob",
      folderId: "f1",
      roomId: "r1",
    });
  });
});
