/**
 * Guest-first 30s path: POST /public/rooms/:roomId/guest-session.
 * Exercises the real chain: route -> public guest guard (origin, rate limit,
 * Turnstile) -> public room check -> share token -> stable guest id -> JWT mint.
 * This is the claim the landing hero sells ("No signup required").
 */
import { describe, expect, it, vi } from "vitest";
import { dispatchPublicRoutes } from "./public-http.js";

const ROOM_ID = "lobby";
const PROJECT_ID = "proj-guest";
const GUEST_KEY = "guestkey-abcdefghij123456";

function buildGuestDeps({
  room = { id: ROOM_ID, project_id: PROJECT_ID, type: "public" },
  publicRoom = true,
  jwtSecret = "guest-jwt-secret-for-tests-32b",
  customDomain = null,
  env: envOverrides = {},
  signJwtHs256 = vi.fn(async () => "signed.guest.jwt"),
} = {}) {
  return {
    env: {
      NODE_ENV: "test",
      PUBLIC_GUEST_ENABLED: "true",
      RATE_LIMIT_FALLBACK_ALLOW: "true",
      DB: {
        prepare(sql) {
          const stmt = {
            async first() {
              if (sql.includes("type = 'public'")) {
                return publicRoom && room ? { id: room.id } : null;
              }
              if (sql.includes("type FROM rooms")) {
                return room;
              }
              if (sql.includes("project_id FROM rooms")) {
                return room ? { project_id: room.project_id } : null;
              }
              if (sql.includes("project_secrets")) {
                return jwtSecret ? { jwt_secret: jwtSecret } : null;
              }
              return null;
            },
            async all() {
              return { results: [] };
            },
            async run() {
              return {};
            },
            bind() {
              return stmt;
            },
          };
          return stmt;
        },
        async batch() {
          return [];
        },
      },
      ...envOverrides,
    },
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
    verifyJwtAndGetContext: async () => null,
    hasAnyRole: () => false,
    logError: () => {},
    writeAuditEvent: async () => {},
    sanitizeString: (value) => value,
    validateFileUpload: () => ({ valid: true }),
    getFileExtension: () => "",
    resolveProjectId: async () => PROJECT_ID,
    insertNewProject: async () => ({}),
    isValidId: (id) => /^[a-zA-Z0-9_-]{1,128}$/.test(id),
    validateRoles: () => ({ valid: true, roles: ["member"] }),
    signJwtHs256,
    maxRoomNameLength: 128,
    projectId: "default",
    checkAndConsumeRateLimit: async () => ({ allowed: true, retryAfterSeconds: 0 }),
    canAccessRoom: async () => true,
    customDomain,
    timingSafeEqual: async (a, b) => a === b,
  };
}

function guestRequest(body, { method = "POST", roomId = ROOM_ID } = {}) {
  return new Request(
    `https://api.example.com/public/rooms/${encodeURIComponent(roomId)}/guest-session`,
    {
      method,
      headers: {
        Origin: "https://api.example.com",
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
    },
  );
}

async function callGuest(deps, body, opts) {
  const request = guestRequest(body, opts);
  const response = await dispatchPublicRoutes(request, new URL(request.url), deps);
  expect(response).not.toBeNull();
  return response;
}

describe("POST /public/rooms/:roomId/guest-session", () => {
  it("mints a guest session for a public room", async () => {
    const signJwtHs256 = vi.fn(async () => "signed.guest.jwt");
    const deps = buildGuestDeps({ signJwtHs256 });
    const response = await callGuest(deps, {
      guestKey: GUEST_KEY,
      displayName: "Ada Lovelace",
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.enabled).toBe(true);
    expect(body.roomId).toBe(ROOM_ID);
    expect(body.projectId).toBe(PROJECT_ID);
    expect(body.userId).toMatch(/^guest_[0-9a-f]{22}$/);
    expect(body.token).toBe("signed.guest.jwt");
    expect(body.expiresIn).toBe(3600);
    expect(body.readOnly).toBe(false);
    expect(body.roles).toEqual(["guest"]);
    const [secret, payload] = signJwtHs256.mock.calls[0];
    expect(secret).toBe("guest-jwt-secret-for-tests-32b");
    expect(payload).toMatchObject({
      tid: PROJECT_ID,
      roomId: ROOM_ID,
      roles: ["guest"],
      name: "Ada Lovelace",
    });
  });

  it("derives a stable guest id from the persisted guestKey", async () => {
    const first = await (await callGuest(buildGuestDeps(), { guestKey: GUEST_KEY })).json();
    const second = await (await callGuest(buildGuestDeps(), { guestKey: GUEST_KEY })).json();
    const other = await (
      await callGuest(buildGuestDeps(), { guestKey: "another-key-1234567890" })
    ).json();
    expect(first.userId).toBe(second.userId);
    expect(other.userId).not.toBe(first.userId);
  });

  it("404s when public guests are disabled", async () => {
    const deps = buildGuestDeps({ env: { PUBLIC_GUEST_ENABLED: "false" } });
    const response = await callGuest(deps, { guestKey: GUEST_KEY });
    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe("public_guest_disabled");
  });

  it("400s on an invalid room id", async () => {
    const response = await callGuest(
      buildGuestDeps(),
      { guestKey: GUEST_KEY },
      { roomId: "a..b" },
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid roomId");
  });

  it("404s when the room does not exist", async () => {
    const response = await callGuest(buildGuestDeps({ room: null }), { guestKey: GUEST_KEY });
    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe("room_not_found");
  });

  it("403s when the room is not public", async () => {
    const response = await callGuest(buildGuestDeps({ publicRoom: false }), {
      guestKey: GUEST_KEY,
    });
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe("room_not_public");
  });

  it("403s on a malformed share token", async () => {
    const response = await callGuest(buildGuestDeps(), {
      guestKey: GUEST_KEY,
      shareToken: "not-a-token",
    });
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe("invalid_share_token");
  });

  it("503s on hosted when Turnstile is required but not configured", async () => {
    const deps = buildGuestDeps({ env: { HOSTED_MULTI_TENANT: "true" } });
    const response = await callGuest(deps, { guestKey: GUEST_KEY });
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe("turnstile_not_configured");
  });

  it("403s on a custom domain when the room belongs to another project", async () => {
    const deps = buildGuestDeps({ customDomain: { projectId: "other-project" } });
    const response = await callGuest(deps, { guestKey: GUEST_KEY });
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe("room_not_in_project");
  });

  it("marks read-only when PUBLIC_GUEST_READ_ONLY is set", async () => {
    const deps = buildGuestDeps({ env: { PUBLIC_GUEST_READ_ONLY: "true" } });
    const response = await callGuest(deps, { guestKey: GUEST_KEY });
    expect((await response.json()).readOnly).toBe(true);
  });

  it("also accepts GET (no body)", async () => {
    const response = await callGuest(buildGuestDeps(), undefined, { method: "GET" });
    expect(response.status).toBe(200);
  });
});
