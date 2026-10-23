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
      const value = map.get(key);
      // Real DO storage hands back structured clones, never live references.
      return value === undefined ? undefined : structuredClone(value);
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

function walFallbackDb({ uniqueFail = new Set(), transientFail = new Set(), existingId = null } = {}) {
  let nextId = 10;
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async run() {
              const clientMessageId = args[14];
              if (transientFail.has(clientMessageId)) {
                throw new Error("D1_ERROR: transient write failure");
              }
              if (uniqueFail.has(clientMessageId)) {
                throw new Error(
                  "UNIQUE constraint failed: messages.project_id, messages.room_id, messages.client_message_id",
                );
              }
              return { meta: { last_row_id: nextId++ } };
            },
            async first() {
              return existingId == null ? null : { id: existingId };
            },
          };
        },
      };
    },
    async batch() {
      throw new Error(
        "UNIQUE constraint failed: messages.project_id, messages.room_id, messages.client_message_id",
      );
    },
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

  it("serializes enqueue through storage.transaction when available (audit F-53)", async () => {
    const map = new Map();
    let txns = 0;
    const storage = {
      async get(key) {
        return map.get(key);
      },
      async put(key, value) {
        map.set(key, value);
      },
      async delete(key) {
        map.delete(key);
      },
      async transaction(fn) {
        txns += 1;
        return fn(storage);
      },
    };
    await enqueueMessageWal(storage, chatRow("a"));
    await enqueueMessageWal(storage, chatRow("b"));
    expect(txns).toBe(2);
    expect((await loadMessageWal(storage)).map((r) => r.content)).toEqual([
      "hello-a",
      "hello-b",
    ]);
  });

  it("keeps a message enqueued while the flush writes to D1 (audit F-53)", async () => {
    const storage = memoryStorage();
    const db = recordingDb();
    const originalBatch = db.batch.bind(db);
    db.batch = async (stmts) => {
      // A second send lands while D1 is persisting the first batch.
      await enqueueMessageWal(storage, chatRow("late"));
      return originalBatch(stmts);
    };
    await enqueueMessageWal(storage, chatRow("early"));
    const flushed = await flushMessageWal(storage, db);
    expect(flushed).toHaveLength(1);
    const remaining = await loadMessageWal(storage);
    expect(remaining.map((r) => r.content)).toEqual(["hello-late"]);
  });

  it("falls back to per-row when the batch fails: a duplicate clientMessageId leaves the queue, others persist", async () => {
    const storage = memoryStorage();
    const db = walFallbackDb({ uniqueFail: new Set(["cmsg_b"]), existingId: 99 });
    await enqueueMessageWal(storage, chatRow("a"));
    await enqueueMessageWal(storage, chatRow("b"));
    const flushed = await flushMessageWal(storage, db);
    expect(flushed.map((row) => row.content)).toEqual(["hello-a"]);
    expect(flushed[0].messageId).toBe(10);
    expect(await loadMessageWal(storage)).toEqual([]);
  });

  it("keeps only the transiently failing row for the next flush", async () => {
    const storage = memoryStorage();
    const db = walFallbackDb({ transientFail: new Set(["cmsg_b"]) });
    await enqueueMessageWal(storage, chatRow("a"));
    await enqueueMessageWal(storage, chatRow("b"));
    const flushed = await flushMessageWal(storage, db);
    expect(flushed.map((row) => row.content)).toEqual(["hello-a"]);
    expect((await loadMessageWal(storage)).map((r) => r.content)).toEqual(["hello-b"]);
  });

  it("keeps an unresolved unique failure queued instead of dropping it", async () => {
    const storage = memoryStorage();
    const db = walFallbackDb({ uniqueFail: new Set(["cmsg_a"]) });
    await enqueueMessageWal(storage, chatRow("a"));
    const flushed = await flushMessageWal(storage, db);
    expect(flushed).toEqual([]);
    expect((await loadMessageWal(storage)).map((r) => r.content)).toEqual(["hello-a"]);
  });
});
