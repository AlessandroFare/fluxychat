import { describe, expect, it } from "vitest";
import { createAuthMatrixDeps } from "./auth-matrix-deps.js";
import { dispatchMessagesRoutes } from "./messages-http.js";

const ROW = {
  id: 1,
  room_id: "room-1",
  user_id: "user_bob",
  deleted_at: null,
  version: 1,
  metadata_json: null,
};

function fakeDb({ conflict = false } = {}) {
  const calls = { updateSql: "", events: 0, fanouts: 0 };
  const db = {
    calls,
    prepare(sql) {
      return {
        bind(...params) {
          void params;
          return {
            async first() {
              if (sql.includes("FROM messages")) return ROW;
              if (sql.includes("FROM room_message_seq")) return { last_seq: 1 };
              return null;
            },
            async all() {
              return { results: [] };
            },
            async run() {
              if (sql.includes("UPDATE messages SET content")) {
                calls.updateSql = sql;
                return { meta: { changes: conflict ? 0 : 1 } };
              }
              if (sql.includes("INSERT INTO room_message_events")) {
                calls.events += 1;
                return { meta: { last_row_id: 1, changes: 1 } };
              }
              return { meta: { changes: 1, last_row_id: 1 } };
            },
          };
        },
      };
    },
    async batch() {
      return [];
    },
  };
  return db;
}

function deps(db) {
  return createAuthMatrixDeps({
    verifyJwt: async () => ({ userId: "user_bob", projectId: "p1", roles: ["member"] }),
    extra: {
      env: {
        DB: db,
        ROOM: {
          idFromName: (name) => name,
          get: () => ({
            fetch: async () => {
              db.calls.fanouts += 1;
              return new Response("{}");
            },
          }),
        },
      },
    },
  });
}

function patch(db) {
  const req = new Request("http://127.0.0.1:8787/messages/1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: "edited" }),
  });
  return dispatchMessagesRoutes(req, new URL(req.url), deps(db));
}

describe("PATCH /messages/:id optimistic versioning (P12)", () => {
  it("P12: a losing concurrent edit (version guard miss) is a 409 with no event or fanout", async () => {
    const db = fakeDb({ conflict: true });
    const res = await patch(db);
    expect(res.status).toBe(409);
    expect(db.calls.events).toBe(0);
    expect(db.calls.fanouts).toBe(0);
  });

  it("P12: a successful edit persists the bumped version", async () => {
    const db = fakeDb();
    const res = await patch(db);
    expect(res.status).toBe(200);
    expect(db.calls.updateSql).toContain("version = ?");
    expect(db.calls.events).toBe(1);
  });
});
