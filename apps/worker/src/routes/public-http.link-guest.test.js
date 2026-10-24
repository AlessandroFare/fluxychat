/**
 * POST /tokens/link-guest — a signed-in account claims a guest identity
 * (nakama borrow). Route-level: auth, lib delegation, audit event.
 */
import { describe, expect, it, vi } from "vitest";
import { dispatchPublicRoutes } from "./public-http.js";

const PROJECT_ID = "p1";

const TOKENS = {
  "member.jwt": { userId: "u_target", projectId: PROJECT_ID, roles: ["member"] },
  "guest.jwt": { userId: "u_guest", projectId: PROJECT_ID, roles: ["guest"] },
};

function createDb({ members = [], links = [] } = {}) {
  const state = { members, links };
  return {
    state,
    prepare(sql) {
      const stmt = {
        sql,
        params: [],
        bind(...params) {
          stmt.params = params;
          return stmt;
        },
        async first() {
          if (sql.includes("FROM guest_links")) {
            const [projectId, guestUserId] = stmt.params;
            const row = state.links.find(
              (l) => l.project_id === projectId && l.guest_user_id === guestUserId,
            );
            return row ? { target_user_id: row.target_user_id } : null;
          }
          return null;
        },
        async all() {
          if (sql.includes("FROM room_members") && sql.includes("JOIN rooms")) {
            const [userId] = stmt.params;
            return {
              results: state.members
                .filter((m) => m.user_id === userId)
                .map((m) => ({ room_id: m.room_id, role: m.role })),
            };
          }
          return { results: [] };
        },
        async run() {
          return { meta: {} };
        },
      };
      return stmt;
    },
    async batch(statements) {
      for (const stmt of statements) {
        if (stmt.sql.includes("UPDATE room_members")) {
          const [targetUserId, guestUserId, ...roomIds] = stmt.params;
          for (const member of state.members) {
            if (member.user_id === guestUserId && roomIds.includes(member.room_id)) {
              member.user_id = targetUserId;
              if (member.role === "guest") member.role = "member";
            }
          }
        } else if (stmt.sql.includes("DELETE FROM room_members")) {
          const [guestUserId, ...roomIds] = stmt.params;
          state.members = state.members.filter(
            (m) => !(m.user_id === guestUserId && roomIds.includes(m.room_id)),
          );
        } else if (stmt.sql.includes("INSERT INTO guest_links")) {
          const [project_id, guest_user_id, target_user_id, linked_at] = stmt.params;
          state.links.push({ project_id, guest_user_id, target_user_id, linked_at });
        }
      }
    },
  };
}

function buildDeps({ db = createDb(), writeAuditEvent = vi.fn(async () => {}) } = {}) {
  return {
    env: { NODE_ENV: "test", DB: db },
    ctx: { waitUntil() {} },
    traceId: "trace-test",
    json(body, init = {}) {
      return new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { "Content-Type": "application/json" },
      });
    },
    corsHeaders: {},
    requestLogCtx: {},
    verifyJwtAndGetContext: async (request, _env, opts = {}) => {
      const header = request.headers.get("Authorization") ?? "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : "";
      const payload = TOKENS[token];
      if (!payload) throw new Response("Invalid token", { status: 401 });
      if (opts.expectedProjectId && payload.projectId !== opts.expectedProjectId) {
        throw new Response("Unauthorized", { status: 401 });
      }
      return payload;
    },
    hasAnyRole: () => false,
    logError: () => {},
    writeAuditEvent,
    sanitizeString: (value) => value,
    validateFileUpload: () => ({ valid: true }),
    getFileExtension: () => "",
    resolveProjectId: async () => PROJECT_ID,
    insertNewProject: async () => ({}),
    isValidId: (id) => /^[a-zA-Z0-9_-]{1,128}$/.test(id),
    validateRoles: () => ({ valid: true, roles: ["member"] }),
    signJwtHs256: async () => "signed.jwt",
    maxRoomNameLength: 128,
    projectId: "default",
    checkAndConsumeRateLimit: async () => ({ allowed: true, retryAfterSeconds: 0 }),
    canAccessRoom: async () => true,
    customDomain: null,
    timingSafeEqual: async (a, b) => a === b,
  };
}

function linkRequest({ token, body = {} } = {}) {
  return new Request("https://api.example.com/tokens/link-guest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /tokens/link-guest", () => {
  it("returns 401 without a caller token", async () => {
    const request = linkRequest({ body: { guestToken: "guest.jwt" } });
    const res = await dispatchPublicRoutes(request, new URL(request.url), buildDeps());
    expect(res.status).toBe(401);
  });

  it("claims the guest, moves the membership, and writes an audit event", async () => {
    const db = createDb({
      members: [{ room_id: "r1", user_id: "u_guest", role: "guest" }],
    });
    const writeAuditEvent = vi.fn(async () => {});
    const request = linkRequest({ token: "member.jwt", body: { guestToken: "guest.jwt" } });
    const res = await dispatchPublicRoutes(
      request,
      new URL(request.url),
      buildDeps({ db, writeAuditEvent }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      guestUserId: "u_guest",
      targetUserId: "u_target",
      roomsTransferred: 1,
      roomsAlreadyMember: 0,
    });
    expect(db.state.members).toEqual([{ room_id: "r1", user_id: "u_target", role: "member" }]);
    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        projectId: PROJECT_ID,
        action: "guest.linked",
        actorUserId: "u_target",
        metadata: { guestUserId: "u_guest", roomsTransferred: 1, roomsAlreadyMember: 0 },
      }),
    );
  });

  it("passes through the 409 when the guest was already claimed", async () => {
    const db = createDb({
      links: [{ project_id: PROJECT_ID, guest_user_id: "u_guest", target_user_id: "u_first" }],
    });
    const request = linkRequest({ token: "member.jwt", body: { guestToken: "guest.jwt" } });
    const res = await dispatchPublicRoutes(request, new URL(request.url), buildDeps({ db }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      error: "guest_already_linked",
      targetUserId: "u_first",
    });
  });

  it("returns 400 when the guest token is missing", async () => {
    const request = linkRequest({ token: "member.jwt" });
    const res = await dispatchPublicRoutes(request, new URL(request.url), buildDeps());
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "guest_token_required" });
  });
});
