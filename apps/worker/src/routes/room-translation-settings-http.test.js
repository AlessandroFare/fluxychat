import { describe, expect, it } from "vitest";
import { dispatchRoomTranslationSettingsRoutes } from "./room-translation-settings-http.js";

function mockDb(rows = new Map()) {
  return {
    DB: {
      prepare(sql) {
        return {
          bind(...params) {
            return {
              async first() {
                if (sql.includes("FROM room_translation_settings")) {
                  return rows.get(`${params[0]}:${params[1]}`) ?? null;
                }
                return null;
              },
              async all() {
                if (sql.includes("FROM room_translation_settings")) {
                  return {
                    results: [...rows.values()].filter((row) => row.project_id === params[0]),
                  };
                }
                return { results: [] };
              },
              async run() {
                if (sql.includes("INSERT INTO room_translation_settings")) {
                  rows.set(`${params[0]}:${params[1]}`, {
                    project_id: params[0],
                    room_id: params[1],
                    enabled: params[2],
                    auto_translate_target: params[3],
                    updated_at: params[4],
                  });
                }
                return { meta: { changes: 1 } };
              },
            };
          },
        };
      },
    },
  };
}

function makeHandler(env, overrides = {}) {
  return {
    env,
    json: (body, init = {}) =>
      new Response(JSON.stringify(body), {
        status: init.status || 200,
        headers: { "content-type": "application/json", ...(init.headers || {}) },
      }),
    corsHeaders: {},
    requestLogCtx: {},
    verifyJwtAndGetContext: async () => ({ projectId: "p1", userId: "u1", roles: ["admin"] }),
    hasAnyRole: (roles, allowed) =>
      Array.isArray(roles) && roles.some((role) => allowed.includes(role)),
    canAccessRoom: async () => true,
    logError: () => {},
    ...overrides,
  };
}

async function call(handler, method, path, body) {
  const request = new Request(`https://worker.test${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return dispatchRoomTranslationSettingsRoutes(request, new URL(request.url), handler);
}

describe("room translation settings routes", () => {
  it("returns 401 without a JWT", async () => {
    const handler = makeHandler(mockDb(), { verifyJwtAndGetContext: async () => null });
    const res = await call(handler, "GET", "/rooms/room-a/translation-settings");
    expect(res.status).toBe(401);
  });

  it("returns 403 when a member lists admin settings", async () => {
    const handler = makeHandler(mockDb(), {
      verifyJwtAndGetContext: async () => ({ projectId: "p1", userId: "u1", roles: ["member"] }),
    });
    const res = await call(handler, "GET", "/admin/room-translation-settings");
    expect(res.status).toBe(403);
  });

  it("returns 403 when the room is outside the project", async () => {
    const handler = makeHandler(mockDb(), { canAccessRoom: async () => false });
    const res = await call(handler, "GET", "/rooms/room-a/translation-settings");
    expect(res.status).toBe(403);
  });

  it("rejects enabled without a target language", async () => {
    const res = await call(
      makeHandler(mockDb()),
      "PATCH",
      "/rooms/room-a/translation-settings",
      { enabled: true },
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("auto_translate_target_required");
  });

  it("persists settings and returns them on the next read", async () => {
    const handler = makeHandler(mockDb());
    const patch = await call(handler, "PATCH", "/rooms/room-a/translation-settings", {
      enabled: true,
      autoTranslateTarget: "es",
    });
    expect(patch.status).toBe(200);
    expect((await patch.json()).settings).toMatchObject({
      enabled: true,
      autoTranslateTarget: "es",
    });

    const get = await call(handler, "GET", "/rooms/room-a/translation-settings");
    expect(get.status).toBe(200);
    expect((await get.json()).settings).toMatchObject({
      enabled: true,
      autoTranslateTarget: "es",
    });
  });
});
