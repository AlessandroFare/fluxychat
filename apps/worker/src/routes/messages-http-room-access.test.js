import { describe, expect, it } from "vitest";
import { createAuthMatrixDeps } from "./auth-matrix-deps.js";
import { dispatchMessagesRoutes } from "./messages-http.js";

const AUTHOR_ROW = { id: 1, room_id: "room-1", user_id: "user_bob", content: "hello" };
const POLL_ROW = {
  question: "Q?",
  options_json: JSON.stringify(["A", "B"]),
  allow_multiple: 0,
  closed: 0,
  room_id: "room-1",
};

function fakeDb(row = AUTHOR_ROW, poll = POLL_ROW) {
  const calls = { updates: 0, votes: 0 };
  return {
    calls,
    prepare(sql) {
      return {
        bind() {
          return {
            async first() {
              if (sql.includes("FROM message_polls")) return poll;
              if (sql.includes("FROM messages")) return row;
              return null;
            },
            async all() {
              return { results: [] };
            },
            async run() {
              if (sql.includes("UPDATE messages")) calls.updates += 1;
              if (sql.includes("INSERT OR REPLACE INTO message_poll_votes")) calls.votes += 1;
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
}

function deps({ canAccess = true, db = fakeDb() } = {}) {
  return createAuthMatrixDeps({
    verifyJwt: async () => ({ userId: "user_bob", projectId: "p1", roles: ["member"] }),
    extra: {
      env: {
        DB: db,
        ROOM: {
          idFromName: (name) => name,
          get: () => ({ fetch: async () => new Response("{}") }),
        },
      },
      canAccessRoom: async () => canAccess,
    },
  });
}

function request(path, { deps: depOverrides, ...init } = {}) {
  const req = new Request(`http://127.0.0.1:8787${path}`, init);
  return dispatchMessagesRoutes(req, new URL(req.url), deps(depOverrides));
}

describe("message mutations require access to the message's room (P8/P9)", () => {
  it("P8: DELETE /messages/:id is forbidden when the caller cannot access the message's room", async () => {
    const db = fakeDb();
    const res = await request("/messages/1", { method: "DELETE", deps: { canAccess: false, db } });
    expect(res.status).toBe(403);
    expect(db.calls.updates).toBe(0);
  });

  it("P8 control: the author can still delete their message with room access", async () => {
    const db = fakeDb();
    const res = await request("/messages/1", { method: "DELETE", deps: { db } });
    expect(res.status).toBe(200);
    expect(db.calls.updates).toBe(1);
  });

  it("P9: POST reactions is forbidden when the caller cannot access the message's room", async () => {
    const res = await request("/messages/1/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji: "👍" }),
      deps: { canAccess: false },
    });
    expect(res.status).toBe(403);
  });

  it("P9 control: reactions still work with room access", async () => {
    const res = await request("/messages/1/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji: "👍" }),
      deps: {},
    });
    expect(res.status).toBe(200);
  });

  it("P10: a poll vote is forbidden when the caller cannot access the poll's room", async () => {
    const db = fakeDb();
    const res = await request("/messages/1/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionIndex: 0 }),
      deps: { canAccess: false, db },
    });
    expect(res.status).toBe(403);
    expect(db.calls.votes).toBe(0);
  });

  it("P10 control: a member with room access can still vote", async () => {
    const db = fakeDb();
    const res = await request("/messages/1/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionIndex: 0 }),
      deps: { db },
    });
    expect(res.status).toBe(200);
    expect(db.calls.votes).toBe(1);
  });

  it("P10-b: GET /messages/:id/poll is forbidden without access to the room", async () => {
    const res = await request("/messages/1/poll", { deps: { canAccess: false } });
    expect(res.status).toBe(403);
  });

  it("P10-b control: GET /messages/:id/poll works with room access", async () => {
    const res = await request("/messages/1/poll", { deps: {} });
    expect(res.status).toBe(200);
  });

  it("P10-b: a non-author cannot close someone else's poll", async () => {
    const db = fakeDb({ ...AUTHOR_ROW, user_id: "user_alice" });
    const res = await request("/messages/1/poll", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ closed: true }),
      deps: { db },
    });
    expect(res.status).toBe(403);
  });

  it("P10-b control: the author can close their poll with room access", async () => {
    const res = await request("/messages/1/poll", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ closed: true }),
      deps: {},
    });
    expect(res.status).toBe(200);
  });
});
