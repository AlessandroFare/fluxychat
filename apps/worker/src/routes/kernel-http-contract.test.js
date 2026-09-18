/**
 * Phase 1 kernel contracts: auth, rooms, messages, inbox, GDPR, presence.
 * Behavioral (status + error code), not dispatcher wiring.
 */
import { describe, expect, it } from "vitest";
import { createAuthMatrixDeps, unauthorizedRequest } from "./auth-matrix-deps.js";
import { dispatchMessagesRoutes } from "./messages-http.js";
import { dispatchRoomsMutationsRoutes } from "./rooms-mutations-http.js";
import { dispatchRoomsListExportRoutes } from "./rooms-list-export-http.js";
import { dispatchInboxRoutes } from "./inbox-http.js";
import { dispatchGdprRoutes } from "./gdpr-http.js";
import { dispatchPresenceRoutes } from "./presence-http.js";
import { dispatchNotificationsRoutes } from "./notifications-http.js";

const memberJwt = async () => ({
  userId: "u1",
  projectId: "p1",
  roles: ["member"],
});

function kernelDb() {
  return {
    prepare(sql) {
      const text = String(sql);
      return {
        bind() {
          return {
            first: async () => {
              if (text.includes("FROM rooms")) return { id: "room-1", type: "group" };
              if (text.includes("FROM room_members")) return { ok: 1, user_id: "u1" };
              return null;
            },
            all: async () => ({ results: [] }),
            run: async () => ({ success: true }),
          };
        },
      };
    },
  };
}

function deps(overrides = {}) {
  return createAuthMatrixDeps({
    db: overrides.db ?? kernelDb(),
    verifyJwt: overrides.verifyJwt ?? memberJwt,
    extra: {
      quotaResetInfo: () => ({
        resetsAt: "2026-10-01T00:00:00.000Z",
        retryAfterSeconds: 3600,
      }),
      canAccessRoom: overrides.canAccessRoom ?? (async () => true),
      getCachedOrFetch: async (_env, _key, fn) => fn(),
      checkAndConsumeProjectQuota:
        overrides.checkAndConsumeProjectQuota ?? (async () => ({ allowed: true })),
      checkAndConsumeRateLimit:
        overrides.checkAndConsumeRateLimit ?? (async () => ({ allowed: true })),
      env: {
        DB: overrides.db ?? kernelDb(),
        PUBLIC_GUEST_READ_ONLY: overrides.guestReadOnly ? "true" : undefined,
        DATA_RESIDENCY_ENFORCE: "false",
        ...(overrides.env || {}),
      },
      ...overrides.extra,
    },
  });
}

function jsonReq(path, { method = "GET", body } = {}) {
  return unauthorizedRequest(path, { method, body });
}

describe("kernel HTTP — messages", () => {
  it("POST /messages without JWT is 401", async () => {
    const req = jsonReq("/messages", { method: "POST", body: { roomId: "room-1", content: "hi" } });
    const res = await dispatchMessagesRoutes(req, new URL(req.url), createAuthMatrixDeps());
    expect(res.status).toBe(401);
  });

  it("POST /messages with invalid JSON object is 400", async () => {
    const req = jsonReq("/messages", { method: "POST", body: [] });
    const res = await dispatchMessagesRoutes(req, new URL(req.url), deps());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_body");
  });

  it("POST /messages with empty roomId is 400", async () => {
    const req = jsonReq("/messages", { method: "POST", body: { roomId: "  ", content: "hi" } });
    const res = await dispatchMessagesRoutes(req, new URL(req.url), deps());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(String(body.error)).toMatch(/roomId/);
  });

  it("POST /messages when canAccessRoom is false is 403 forbidden", async () => {
    const req = jsonReq("/messages", { method: "POST", body: { roomId: "room-1", content: "hi" } });
    const res = await dispatchMessagesRoutes(
      req,
      new URL(req.url),
      deps({ canAccessRoom: async () => false }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("forbidden");
  });

  it("POST /messages guest-only + PUBLIC_GUEST_READ_ONLY is 403 guest_read_only", async () => {
    const req = jsonReq("/messages", { method: "POST", body: { roomId: "room-1", content: "hi" } });
    const res = await dispatchMessagesRoutes(
      req,
      new URL(req.url),
      deps({
        guestReadOnly: true,
        verifyJwt: async () => ({ userId: "g1", projectId: "p1", roles: ["guest"] }),
      }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("guest_read_only");
  });

  it("POST /messages over project quota is 402 quota_exceeded", async () => {
    const req = jsonReq("/messages", { method: "POST", body: { roomId: "room-1", content: "hi" } });
    const res = await dispatchMessagesRoutes(
      req,
      new URL(req.url),
      deps({
        checkAndConsumeProjectQuota: async () => ({
          allowed: false,
          metricName: "messages_created",
          limit: 100,
          used: 100,
          monthKey: "2026-09",
        }),
      }),
    );
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe("quota_exceeded");
    expect(body.metric).toBe("messages_created");
  });

  it("POST /messages over per-user rate limit is 429 rate_limit_exceeded", async () => {
    const req = jsonReq("/messages", { method: "POST", body: { roomId: "room-1", content: "hi" } });
    const res = await dispatchMessagesRoutes(
      req,
      new URL(req.url),
      deps({
        checkAndConsumeRateLimit: async () => ({
          allowed: false,
          retryAfterSeconds: 12,
        }),
      }),
    );
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("rate_limit_exceeded");
    expect(res.headers.get("Retry-After")).toBe("12");
  });

  it("POST /messages with oversize content is 400", async () => {
    const { validateMessageContent } = await import("../lib/message-validation.js");
    const req = jsonReq("/messages", {
      method: "POST",
      body: { roomId: "room-1", content: "x".repeat(4001) },
    });
    const res = await dispatchMessagesRoutes(
      req,
      new URL(req.url),
      deps({ extra: { validateMessageContent } }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(String(body.error)).toMatch(/maximum length/);
  });

  it("401 POST /messages includes CORS headers", async () => {
    const req = jsonReq("/messages", { method: "POST", body: { roomId: "room-1", content: "hi" } });
    const res = await dispatchMessagesRoutes(req, new URL(req.url), createAuthMatrixDeps());
    expect(res.status).toBe(401);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("PATCH /messages/:id without JWT is 401", async () => {
    const req = jsonReq("/messages/1", { method: "PATCH", body: { content: "edited" } });
    const res = await dispatchMessagesRoutes(req, new URL(req.url), createAuthMatrixDeps());
    expect(res.status).toBe(401);
  });

  it("PATCH /messages/:id with empty content is 400", async () => {
    const req = jsonReq("/messages/1", { method: "PATCH", body: {} });
    const res = await dispatchMessagesRoutes(req, new URL(req.url), deps());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("content required");
  });

  it("PATCH /messages/:id of another user is 403", async () => {
    const db = {
      prepare(sql) {
        return {
          bind() {
            return {
              first: async () => {
                if (String(sql).includes("FROM messages")) {
                  return { id: 1, room_id: "room-1", user_id: "someone-else", deleted_at: null };
                }
                return { id: "room-1", type: "group" };
              },
              all: async () => ({ results: [] }),
              run: async () => ({ success: true }),
            };
          },
        };
      },
    };
    const req = jsonReq("/messages/1", { method: "PATCH", body: { content: "nope" } });
    const res = await dispatchMessagesRoutes(req, new URL(req.url), deps({ db }));
    expect(res.status).toBe(403);
  });

  it("DELETE /messages/:id without JWT is 401", async () => {
    const req = jsonReq("/messages/1", { method: "DELETE" });
    const res = await dispatchMessagesRoutes(req, new URL(req.url), createAuthMatrixDeps());
    expect(res.status).toBe(401);
  });
});

describe("kernel HTTP — rooms", () => {
  it("POST /rooms without a name is 400", async () => {
    const req = jsonReq("/rooms", { method: "POST", body: { type: "group" } });
    const res = await dispatchRoomsMutationsRoutes(req, new URL(req.url), deps());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("POST /rooms with unknown type is 400", async () => {
    const req = jsonReq("/rooms", { method: "POST", body: { name: "Lobby", type: "zoom" } });
    const res = await dispatchRoomsMutationsRoutes(req, new URL(req.url), deps());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(String(body.error)).toMatch(/type must be one of/);
  });

  it("GET /rooms with JWT returns a list (empty is ok)", async () => {
    const req = jsonReq("/rooms");
    const res = await dispatchRoomsListExportRoutes(req, new URL(req.url), deps());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.rooms ?? body)).toBe(true);
  });
});

describe("kernel HTTP — inbox, presence, notifications, GDPR", () => {
  it("GET /inbox with a bad where filter is 400", async () => {
    const req = jsonReq("/inbox?where={not-json");
    const res = await dispatchInboxRoutes(req, new URL(req.url), deps());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_where");
  });

  it("GET /inbox with JWT returns a summary object", async () => {
    const req = jsonReq("/inbox");
    const res = await dispatchInboxRoutes(req, new URL(req.url), deps());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(
      expect.objectContaining({
        unreadRooms: expect.any(Array),
        mentions: expect.any(Array),
      }),
    );
  });

  it("DELETE /gdpr/delete as a member is 403", async () => {
    const req = jsonReq("/gdpr/delete", { method: "DELETE" });
    const res = await dispatchGdprRoutes(req, new URL(req.url), deps());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(String(body.error)).toMatch(/owner\/admin/);
  });

  it("POST /rooms/:id/presence without access is 403", async () => {
    const req = jsonReq("/rooms/room-1/presence", {
      method: "POST",
      body: { type: "cursor", payload: {} },
    });
    const res = await dispatchPresenceRoutes(
      req,
      new URL(req.url),
      deps({ canAccessRoom: async () => false }),
    );
    expect(res.status).toBe(403);
  });

  it("GET /notifications without JWT is 401", async () => {
    const req = jsonReq("/notifications");
    const res = await dispatchNotificationsRoutes(req, new URL(req.url), createAuthMatrixDeps());
    expect(res.status).toBe(401);
  });

  it("GET /gdpr/export without JWT is 401", async () => {
    const req = jsonReq("/gdpr/export");
    const res = await dispatchGdprRoutes(req, new URL(req.url), createAuthMatrixDeps());
    expect(res.status).toBe(401);
  });

  it("GET /gdpr/export with JWT returns an export payload", async () => {
    const req = jsonReq("/gdpr/export");
    const res = await dispatchGdprRoutes(req, new URL(req.url), deps());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId === "u1" || body.ok === true || body.messages).toBeTruthy();
  });
});
