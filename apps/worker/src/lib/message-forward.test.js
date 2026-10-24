import { beforeEach, describe, expect, it, vi } from "vitest";

const canAccessRoomMock = vi.fn();
const assertCanPostToRoomMock = vi.fn();
const fanoutMock = vi.fn();

vi.mock("./room-access.js", () => ({
  canAccessRoom: (...args) => canAccessRoomMock(...args),
}));
vi.mock("./room-post-policy.js", () => ({
  assertCanPostToRoom: (...args) => assertCanPostToRoomMock(...args),
}));
vi.mock("./room-shard.js", () => ({
  fanoutRoomInternal: (...args) => fanoutMock(...args),
}));

import { forwardMessage } from "./message-forward.js";

const sourceRow = {
  id: 5,
  room_id: "r-src",
  user_id: "u-author",
  content: "hello forward",
  kind: "text",
  audio_url: null,
  duration_ms: null,
  transcription: null,
  og_title: "Title",
  og_description: null,
  og_image: null,
  og_url: "https://x.example",
};

function createEnv({ source = null, roomName = "general", attachments = [] } = {}) {
  const insertedMessages = [];
  const insertedAttachments = [];
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() {
                if (sql.includes("FROM messages")) return source;
                if (sql.includes("FROM rooms")) return roomName ? { name: roomName } : null;
                return null;
              },
              async all() {
                if (sql.includes("FROM attachments")) return { results: attachments };
                return { results: [] };
              },
              async run() {
                if (sql.includes("INSERT INTO messages")) {
                  insertedMessages.push({ sql, args });
                  return { meta: { last_row_id: 42 } };
                }
                if (sql.includes("INSERT INTO attachments")) {
                  insertedAttachments.push({ sql, args });
                  return { meta: {} };
                }
                return { meta: {} };
              },
            };
          },
        };
      },
      async batch(stmts) {
        for (const stmt of stmts) await stmt.run();
      },
    },
  };
  return { env, insertedMessages, insertedAttachments };
}

describe("message-forward", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canAccessRoomMock.mockResolvedValue(true);
    assertCanPostToRoomMock.mockResolvedValue({ ok: true });
    fanoutMock.mockResolvedValue(undefined);
  });

  it("forwards into a readable target room with metadata, attachments and announce", async () => {
    const { env, insertedMessages, insertedAttachments } = createEnv({
      source: sourceRow,
      attachments: [
        {
          kind: "file",
          url: "/attachments/p1/up/a.txt",
          name: "a.txt",
          size_bytes: 12,
          content_type: "text/plain",
        },
      ],
    });

    const result = await forwardMessage(env, {
      projectId: "p1",
      actorUserId: "u1",
      actorRoles: ["member"],
      messageId: 5,
      targetRoomId: "r-dst",
    });

    expect(result.ok).toBe(true);
    expect(result.message).toMatchObject({
      id: 42,
      roomId: "r-dst",
      content: "hello forward",
      forwardedFrom: {
        messageId: 5,
        roomId: "r-src",
        roomName: "general",
        authorId: "u-author",
      },
    });

    const [insert] = insertedMessages;
    expect(insert.args[0]).toBe("p1");
    expect(insert.args[1]).toBe("r-dst");
    expect(insert.args[2]).toBe("u1");
    expect(JSON.parse(insert.args[13]).forwardedFrom).toMatchObject({ messageId: 5 });

    expect(insertedAttachments).toHaveLength(1);
    expect(insertedAttachments[0].args[1]).toBe("r-dst");
    expect(insertedAttachments[0].args[2]).toBe(42);

    expect(assertCanPostToRoomMock).toHaveBeenCalledWith(
      env,
      expect.objectContaining({ roomId: "r-dst", userId: "u1" }),
    );
    const [, pid, roomId, path, init] = fanoutMock.mock.calls[0];
    expect([pid, roomId, path]).toEqual(["p1", "r-dst", "/announce"]);
    expect(JSON.parse(init.body).forwardedFrom.messageId).toBe(5);
  });

  it("404s a missing source and 403s an unreadable source room", async () => {
    const missing = createEnv({ source: null });
    const notFound = await forwardMessage(missing.env, {
      projectId: "p1",
      actorUserId: "u1",
      messageId: 9,
      targetRoomId: "r-dst",
    });
    expect(notFound).toMatchObject({ ok: false, error: "message_not_found", status: 404 });

    const denied = createEnv({ source: sourceRow });
    canAccessRoomMock.mockResolvedValueOnce(false);
    const forbidden = await forwardMessage(denied.env, {
      projectId: "p1",
      actorUserId: "u1",
      messageId: 5,
      targetRoomId: "r-dst",
    });
    expect(forbidden).toMatchObject({ ok: false, error: "forbidden", status: 403 });
  });

  it("propagates the target post policy and rejects invalid input", async () => {
    assertCanPostToRoomMock.mockResolvedValue({
      ok: false,
      error: "posting_disabled",
      status: 403,
    });
    const { env } = createEnv({ source: sourceRow });
    const blocked = await forwardMessage(env, {
      projectId: "p1",
      actorUserId: "u1",
      messageId: 5,
      targetRoomId: "r-dst",
    });
    expect(blocked).toMatchObject({ ok: false, error: "posting_disabled", status: 403 });

    const invalid = await forwardMessage(env, {
      projectId: "p1",
      actorUserId: "u1",
      messageId: "x",
      targetRoomId: "",
    });
    expect(invalid.error).toBe("invalid_forward");
    expect(canAccessRoomMock).toHaveBeenCalledTimes(2);
  });
});
