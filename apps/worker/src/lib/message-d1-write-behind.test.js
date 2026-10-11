import { describe, expect, it } from "vitest";
import {
  enqueueMessageWal,
  flushMessageWal,
  isMessageWriteBehindEnabled,
  loadMessageWal,
  walHasClientMessageId,
} from "./message-d1-write-behind.js";

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    async get(key) {
      return map.get(key);
    },
    async put(key, value) {
      map.set(key, value);
    },
    async delete(key) {
      map.delete(key);
    },
  };
}

function recordingDb() {
  const batches = [];
  let nextId = 10;
  return {
    batches,
    prepare(sql) {
      return {
        sql,
        bind(...args) {
          return {
            sql,
            args,
            run: async () => ({ meta: { last_row_id: nextId++ } }),
          };
        },
      };
    },
    async batch(stmts) {
      batches.push(stmts);
      const out = [];
      for (const stmt of stmts) {
        out.push(await stmt.run());
      }
      return out;
    },
  };
}

function chatRow(id) {
  return {
    projectId: "p1",
    roomId: "r1",
    userId: "u1",
    content: `hello-${id}`,
    createdAt: "2026-10-11T00:00:00.000Z",
    parentId: null,
    mentions: [],
    preview: null,
    clientMessageId: `cmsg_${id}`,
    visibility: "room",
    attachments: [],
  };
}

describe("message D1 write-behind WAL", () => {
  it("defaults on unless MESSAGE_D1_WRITE_BEHIND=false", () => {
    expect(isMessageWriteBehindEnabled({})).toBe(true);
    expect(isMessageWriteBehindEnabled({ MESSAGE_D1_WRITE_BEHIND: "false" })).toBe(false);
  });

  it("keeps rows in DO storage until flush (crash before D1 has no ack ids)", async () => {
    const storage = memoryStorage();
    const db = recordingDb();
    await enqueueMessageWal(storage, chatRow("a"));
    const pending = await loadMessageWal(storage);
    expect(pending).toHaveLength(1);
    expect(db.batches).toHaveLength(0);
    expect(pending[0].messageId).toBeUndefined();
  });

  it("flushes two queued messages in one D1.batch of INSERTs", async () => {
    const storage = memoryStorage();
    const db = recordingDb();
    await enqueueMessageWal(storage, chatRow("a"));
    await enqueueMessageWal(storage, chatRow("b"));
    const flushed = await flushMessageWal(storage, db);
    expect(flushed.map((row) => row.messageId)).toEqual([10, 11]);
    expect(db.batches[0]).toHaveLength(2);
    expect(await loadMessageWal(storage)).toEqual([]);
  });

  it("dedupes client_message_id still sitting in the WAL", async () => {
    const storage = memoryStorage();
    const wal = await enqueueMessageWal(storage, chatRow("a"));
    expect(walHasClientMessageId(wal, "cmsg_a")).toBe(true);
    expect(walHasClientMessageId(wal, "missing")).toBe(false);
  });
});
