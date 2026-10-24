import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthMatrixDeps } from "./auth-matrix-deps.js";
import { dispatchMessagesRoutes } from "./messages-http.js";
import * as savedLib from "../lib/saved-messages.js";
import * as forwardLib from "../lib/message-forward.js";

vi.mock("../lib/saved-messages.js", () => ({
  saveMessage: vi.fn(async () => ({ ok: true, saved: true })),
  unsaveMessage: vi.fn(async () => ({ ok: true, saved: false })),
}));
vi.mock("../lib/message-forward.js", () => ({
  forwardMessage: vi.fn(async () => ({ ok: true, message: { id: 99, roomId: "room-2" } })),
}));

function fakeDb(row = { room_id: "room-1" }) {
  return {
    prepare(sql) {
      return {
        bind() {
          return {
            async first() {
              if (sql.includes("FROM messages")) return row;
              return null;
            },
          };
        },
      };
    },
  };
}

function deps({ db = fakeDb(), canAccess = true } = {}) {
  return createAuthMatrixDeps({
    db,
    verifyJwt: async () => ({ userId: "user_bob", projectId: "p1", roles: ["member"] }),
    extra: { canAccessRoom: async () => canAccess },
  });
}

function request(path, { method = "GET", body } = {}, h) {
  const init = { method, headers: {} };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const req = new Request(`http://127.0.0.1:8787${path}`, init);
  return dispatchMessagesRoutes(req, new URL(req.url), h);
}

describe("message save routes (Wave E)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("401s without a JWT", async () => {
    const res = await request("/messages/7/save", { method: "POST" }, createAuthMatrixDeps());
    expect(res.status).toBe(401);
  });

  it("POST saves and DELETE unsaves an accessible message", async () => {
    const saved = await request("/messages/7/save", { method: "POST" }, deps());
    expect(saved.status).toBe(200);
    expect(savedLib.saveMessage).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      userId: "user_bob",
      messageId: 7,
      roomId: "room-1",
    });

    const unsaved = await request("/messages/7/save", { method: "DELETE" }, deps());
    expect(unsaved.status).toBe(200);
    expect(savedLib.unsaveMessage).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      userId: "user_bob",
      messageId: 7,
    });
  });

  it("404s an unknown message and 403s an inaccessible room", async () => {
    const missing = await request(
      "/messages/7/save",
      { method: "POST" },
      deps({ db: fakeDb(null) }),
    );
    expect(missing.status).toBe(404);
    expect(savedLib.saveMessage).not.toHaveBeenCalled();

    const denied = await request(
      "/messages/7/save",
      { method: "POST" },
      deps({ canAccess: false }),
    );
    expect(denied.status).toBe(403);
    expect(savedLib.saveMessage).not.toHaveBeenCalled();
  });
});

describe("message forward route (Wave E)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("401s without a JWT", async () => {
    const res = await request(
      "/messages/7/forward",
      { method: "POST", body: { targetRoomId: "room-2" } },
      createAuthMatrixDeps(),
    );
    expect(res.status).toBe(401);
  });

  it("forwards with the actor context and returns 201", async () => {
    const res = await request(
      "/messages/7/forward",
      { method: "POST", body: { targetRoomId: "room-2" } },
      deps(),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).message).toEqual({ id: 99, roomId: "room-2" });
    expect(forwardLib.forwardMessage).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      actorUserId: "user_bob",
      actorRoles: ["member"],
      messageId: 7,
      targetRoomId: "room-2",
    });
  });

  it("400s without a target room and propagates lib denials", async () => {
    const invalid = await request("/messages/7/forward", { method: "POST", body: {} }, deps());
    expect(invalid.status).toBe(400);
    expect(forwardLib.forwardMessage).not.toHaveBeenCalled();

    forwardLib.forwardMessage.mockResolvedValueOnce({
      ok: false,
      error: "forbidden_target_room",
      status: 403,
    });
    const denied = await request(
      "/messages/7/forward",
      { method: "POST", body: { targetRoomId: "room-9" } },
      deps(),
    );
    expect(denied.status).toBe(403);
    expect((await denied.json()).error).toBe("forbidden_target_room");
  });
});
