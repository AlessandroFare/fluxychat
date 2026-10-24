import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthMatrixDeps } from "./auth-matrix-deps.js";
import { dispatchMessagesRoutes } from "./messages-http.js";

const state = vi.hoisted(() => ({
  dispatchCalls: 0,
  persistedRows: [],
  insertAttempts: 0,
  failNextInsert: false,
  hideRowsUntilInsert: false,
}));

// Stub the slash-command lib: the real dispatcher goes through the room DO.
vi.mock("../lib/room-command-dispatch.js", () => ({
  tryDispatchSlashCommand: vi.fn(async (_env, input) => {
    if (!String(input.content || "").startsWith("/")) return { handled: false };
    state.dispatchCalls += 1;
    if (input.clientMessageId) {
      state.persistedRows.push({
        id: 7,
        room_id: input.roomId,
        user_id: input.userId,
        content: input.content,
        created_at: "2026-10-18T10:00:00.000Z",
        parent_id: null,
        edited_at: null,
        deleted_at: null,
        mentions: null,
        og_title: null,
        og_description: null,
        og_image: null,
        og_url: null,
        client_message_id: input.clientMessageId,
        also_to_channel: 0,
      });
    }
    return {
      handled: true,
      ok: true,
      commandResult: { ok: true, action: "poll" },
      message: { id: 7, roomId: input.roomId, content: input.content },
    };
  }),
}));

function fakeDb() {
  return {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async first() {
              if (sql.includes("FROM messages")) {
                if (state.hideRowsUntilInsert && state.insertAttempts === 0) return null;
                return (
                  state.persistedRows.find(
                    (r) => r.client_message_id === params[2],
                  ) || null
                );
              }
              if (sql.includes("FROM rooms")) return { type: "group", name: "general" };
              return null;
            },
            async all() {
              return { results: [] };
            },
            async run() {
              if (sql.includes("INSERT INTO messages")) {
                state.insertAttempts += 1;
                if (state.failNextInsert) {
                  state.failNextInsert = false;
                  throw new Error(
                    "D1_ERROR: UNIQUE constraint failed: messages.room_id, messages.client_message_id, messages.project_id",
                  );
                }
                const row = {
                  id: 99,
                  room_id: params[1],
                  user_id: params[2],
                  content: params[3],
                  created_at: params[4],
                  parent_id: params[5],
                  edited_at: null,
                  deleted_at: null,
                  mentions: params[6],
                  og_title: null,
                  og_description: null,
                  og_image: null,
                  og_url: null,
                  client_message_id: params[11],
                  also_to_channel: params[16],
                };
                state.persistedRows.push(row);
                return { meta: { last_row_id: 99, changes: 1 } };
              }
              return { meta: { last_row_id: 1, changes: 1 } };
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

function deps() {
  return createAuthMatrixDeps({
    verifyJwt: async () => ({ userId: "user_bob", projectId: "p1", roles: ["member"] }),
    extra: {
      env: {
        DB: fakeDb(),
        ROOM: {
          idFromName: (name) => name,
          get: () => ({ fetch: async () => new Response("{}") }),
        },
      },
      incrementOperationalMetric: async () => ({}),
      safeSchedulePostMessageAutomations: async () => ({}),
    },
  });
}

function request(body, h) {
  const req = new Request("http://127.0.0.1:8787/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return dispatchMessagesRoutes(req, new URL(req.url), h);
}

describe("POST /messages idempotency (P6/P7)", () => {
  beforeEach(() => {
    state.dispatchCalls = 0;
    state.persistedRows.length = 0;
    state.insertAttempts = 0;
    state.failNextInsert = false;
    state.hideRowsUntilInsert = false;
  });

  it("P6: a retried slash command with the same clientMessageId is not re-executed", async () => {
    const h = deps();
    const first = await request(
      { roomId: "room-1", content: "/poll Q?", clientMessageId: "cm-slash" },
      h,
    );
    expect(first.status).toBe(200);
    expect(state.dispatchCalls).toBe(1);

    const second = await request(
      { roomId: "room-1", content: "/poll Q?", clientMessageId: "cm-slash" },
      h,
    );
    expect(second.status).toBe(200);
    expect((await second.json()).message?.id).toBe(7);
    expect(state.dispatchCalls).toBe(1);
  });

  it("P7: a duplicate insert race resolves to the winner row instead of throwing", async () => {
    state.hideRowsUntilInsert = true;
    state.failNextInsert = true;
    // The concurrent winner commits after our dedupe lookup ran.
    state.persistedRows.push({
      id: 42,
      room_id: "room-1",
      user_id: "user_bob",
      content: "hello",
      created_at: "2026-10-18T10:00:00.000Z",
      parent_id: null,
      edited_at: null,
      deleted_at: null,
      mentions: null,
      og_title: null,
      og_description: null,
      og_image: null,
      og_url: null,
      client_message_id: "cm-race-1",
      also_to_channel: 0,
    });

    const res = await request(
      { roomId: "room-1", content: "hello", clientMessageId: "cm-race-1" },
      deps(),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).message.id).toBe(42);
    expect(state.insertAttempts).toBe(1);
  });

  it("control: a fresh clientMessageId still inserts and returns the server row", async () => {
    const res = await request(
      { roomId: "room-1", content: "hello", clientMessageId: "cm-new-1" },
      deps(),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).message.id).toBe(99);
    expect(state.insertAttempts).toBe(1);
  });
});
