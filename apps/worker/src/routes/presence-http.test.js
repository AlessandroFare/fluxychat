import { describe, expect, it } from "vitest";
import { createAuthMatrixDeps } from "./auth-matrix-deps.js";
import { dispatchPresenceRoutes } from "./presence-http.js";

/**
 * Fake D1 for `presence_extensions` queries used by
 * `apps/worker/src/lib/presence-extensions.js`.
 */
function createPresenceDb(seed = []) {
  const rows = seed.map((row) => ({ ...row }));
  const nowIso = () => new Date().toISOString();
  const fresh = (row) => row.expires_at == null || row.expires_at > nowIso();
  return {
    rows,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (!sql.includes("SELECT id FROM presence_extensions")) return null;
              const [roomId, userId, type] = args;
              return (
                rows.find(
                  (r) =>
                    r.room_id === roomId && r.user_id === userId && r.presence_type === type,
                ) ?? null
              );
            },
            async all() {
              if (sql.includes("GROUP BY presence_type")) {
                const byType = new Map();
                for (const row of rows.filter((r) => r.room_id === args[0] && fresh(r))) {
                  const users = byType.get(row.presence_type) ?? new Set();
                  users.add(row.user_id);
                  byType.set(row.presence_type, users);
                }
                return {
                  results: [...byType.entries()].map(([presence_type, users]) => ({
                    presence_type,
                    user_count: users.size,
                  })),
                };
              }
              if (sql.includes("WHERE user_id = ?")) {
                const [userId, projectId] = args;
                return {
                  results: rows.filter(
                    (r) => r.user_id === userId && r.project_id === projectId && fresh(r),
                  ),
                };
              }
              if (sql.includes("SELECT user_id, presence_type")) {
                return { results: rows.filter((r) => r.room_id === args[0] && fresh(r)) };
              }
              const type = sql.includes("AND presence_type = ?") ? args[1] : null;
              return {
                results: rows
                  .filter((r) => r.room_id === args[0] && (!type || r.presence_type === type) && fresh(r))
                  .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)),
              };
            },
            async run() {
              if (sql.includes("DELETE FROM presence_extensions")) {
                const userId = sql.includes("AND user_id = ?") ? args[1] : null;
                const type = sql.includes("AND presence_type = ?") ? args[args.length - 1] : null;
                let changes = 0;
                for (let i = rows.length - 1; i >= 0; i -= 1) {
                  const r = rows[i];
                  if (
                    r.room_id === args[0] &&
                    (!userId || r.user_id === userId) &&
                    (!type || r.presence_type === type)
                  ) {
                    rows.splice(i, 1);
                    changes += 1;
                  }
                }
                return { meta: { changes } };
              }
              if (sql.includes("UPDATE presence_extensions")) {
                const [payloadJson, updatedAt, expiresAt, id] = args;
                const row = rows.find((r) => r.id === id);
                if (row) {
                  row.payload_json = payloadJson;
                  row.updated_at = updatedAt;
                  row.expires_at = expiresAt;
                }
                return { meta: { changes: row ? 1 : 0 } };
              }
              if (sql.includes("INSERT INTO presence_extensions")) {
                const [id, project_id, room_id, user_id, presence_type, payload_json, updated_at, expires_at] =
                  args;
                rows.push({
                  id,
                  project_id,
                  room_id,
                  user_id,
                  presence_type,
                  payload_json,
                  updated_at,
                  expires_at,
                });
                return { meta: { changes: 1 } };
              }
              return { meta: { changes: 0 } };
            },
          };
        },
      };
    },
  };
}

function presenceRow(overrides = {}) {
  return {
    id: "pres_seed",
    project_id: "p1",
    room_id: "room_1",
    user_id: "user_bob",
    presence_type: "cursor",
    payload_json: '{"x":1,"y":2}',
    // Relative to now: the route filters by expires_at, fixed timestamps rot.
    updated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

function deps(db, overrides = {}) {
  return createAuthMatrixDeps({
    db,
    verifyJwt: async () => ({ userId: "user_bob", projectId: "p1" }),
    ...overrides,
  });
}

function request(path, { method = "GET", body } = {}, h) {
  const init = { method, headers: {} };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return dispatchPresenceRoutes(
    new Request(`http://127.0.0.1:8787${path}`, init),
    new URL(`http://127.0.0.1:8787${path}`),
    h,
  );
}

describe("presence routes", () => {
  it("401s without a JWT", async () => {
    const res = await request("/rooms/room_1/presence", {}, createAuthMatrixDeps());
    expect(res.status).toBe(401);
  });

  it("403s when the room is not accessible", async () => {
    const db = createPresenceDb();
    const res = await request(
      "/rooms/room_1/presence",
      {},
      deps(db, { extra: { canAccessRoom: async () => false } }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("forbidden");
  });

  it("POST creates then updates the same presence row", async () => {
    const db = createPresenceDb();
    const h = deps(db);

    const first = await request(
      "/rooms/room_1/presence",
      { method: "POST", body: { type: "cursor", payload: { x: 1, y: 2 } } },
      h,
    );
    expect(first.status).toBe(200);
    const created = await first.json();
    expect(created.created).toBe(true);
    expect(created.id).toMatch(/^pres_/);
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0]).toMatchObject({
      project_id: "p1",
      room_id: "room_1",
      user_id: "user_bob",
      presence_type: "cursor",
      payload_json: '{"x":1,"y":2}',
    });

    const second = await request(
      "/rooms/room_1/presence",
      { method: "POST", body: { type: "cursor", payload: { x: 9, y: 9 } } },
      h,
    );
    const updated = await second.json();
    expect(updated.updated).toBe(true);
    expect(updated.id).toBe(created.id);
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0].payload_json).toBe('{"x":9,"y":9}');
  });

  it("POST 400s without a type", async () => {
    const res = await request("/rooms/room_1/presence", { method: "POST", body: {} }, deps(createPresenceDb()));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("type required");
  });

  it("POST 400s on an unknown presence type", async () => {
    const res = await request(
      "/rooms/room_1/presence",
      { method: "POST", body: { type: "nope" } },
      deps(createPresenceDb()),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/type must be one of/);
  });

  it("GET room presence skips stale rows and filters by type", async () => {
    const db = createPresenceDb([
      presenceRow({ id: "pres_a", user_id: "user_a" }),
      presenceRow({ id: "pres_b", user_id: "user_b", presence_type: "focus" }),
      presenceRow({ id: "pres_old", user_id: "user_c", expires_at: "2020-01-01T00:00:00.000Z" }),
    ]);
    const h = deps(db);

    const all = await request("/rooms/room_1/presence", {}, h);
    expect(all.status).toBe(200);
    expect((await all.json()).presence.map((row) => row.id).sort()).toEqual(["pres_a", "pres_b"]);

    const cursorOnly = await request("/rooms/room_1/presence?type=cursor", {}, h);
    const body = await cursorOnly.json();
    expect(body.presence).toHaveLength(1);
    expect(body.presence[0].id).toBe("pres_a");
    expect(body.presence[0].type).toBe("cursor");
  });

  it("GET snapshot groups payloads by user and type", async () => {
    const db = createPresenceDb([
      presenceRow({ user_id: "user_a", presence_type: "cursor", payload_json: '{"x":5,"y":6}' }),
      presenceRow({ user_id: "user_a", presence_type: "focus", payload_json: '{"elementId":"el1"}' }),
    ]);
    const res = await request("/rooms/room_1/presence/snapshot", {}, deps(db));
    const { snapshot } = await res.json();
    expect(snapshot.user_a.cursor.payload).toEqual({ x: 5, y: 6 });
    expect(snapshot.user_a.focus.payload).toEqual({ elementId: "el1" });
  });

  it("GET cursors returns only cursor rows", async () => {
    const db = createPresenceDb([
      presenceRow({ user_id: "user_a" }),
      presenceRow({ user_id: "user_b", presence_type: "focus" }),
    ]);
    const res = await request("/rooms/room_1/presence/cursors", {}, deps(db));
    const { cursors } = await res.json();
    expect(cursors).toHaveLength(1);
    expect(cursors[0].type).toBe("cursor");
  });

  it("GET stats counts distinct users per type", async () => {
    const db = createPresenceDb([
      presenceRow({ user_id: "user_a" }),
      presenceRow({ user_id: "user_b" }),
      presenceRow({ user_id: "user_a", presence_type: "focus" }),
    ]);
    const res = await request("/rooms/room_1/presence/stats", {}, deps(db));
    expect((await res.json()).stats).toEqual({ cursor: 2, focus: 1 });
  });

  it("GET /presence/user scopes to the caller project", async () => {
    const db = createPresenceDb([
      presenceRow({ id: "pres_mine" }),
      presenceRow({ id: "pres_other_project", project_id: "p2" }),
      presenceRow({ id: "pres_other_user", user_id: "user_c" }),
    ]);
    const res = await request("/presence/user", {}, deps(db));
    const { presence } = await res.json();
    expect(presence.map((row) => row.id)).toEqual(["pres_mine"]);
  });

  it("DELETE clears only the caller rows, honoring the type filter", async () => {
    const db = createPresenceDb([
      presenceRow({ id: "pres_cursor", user_id: "user_bob", presence_type: "cursor" }),
      presenceRow({ id: "pres_focus", user_id: "user_bob", presence_type: "focus" }),
      presenceRow({ id: "pres_peer", user_id: "user_c", presence_type: "cursor" }),
    ]);
    const h = deps(db);

    const typed = await request("/rooms/room_1/presence?type=cursor", { method: "DELETE" }, h);
    expect((await typed.json()).deleted).toBe(1);
    expect(db.rows.map((row) => row.id).sort()).toEqual(["pres_focus", "pres_peer"]);

    const rest = await request("/rooms/room_1/presence", { method: "DELETE" }, h);
    expect((await rest.json()).deleted).toBe(1);
    expect(db.rows.map((row) => row.id)).toEqual(["pres_peer"]);
  });
});
