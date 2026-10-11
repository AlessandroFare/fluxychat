import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  applyCrdtSnapshotUpdate,
  mergeRestHistoryWithYjsDoc,
  mergeRestHistoryWithYjsRecords,
  detectConflictCandidatesFromMerge,
  readMessagesFromDoc,
  resetRoomMessageCrdtDocsForTests,
  subscribeMessageCrdtMultiTabSync,
  tombstoneMessageInDoc,
  upsertMessageInDoc,
} from "./message-crdt-yjs";

describe("message-crdt-yjs", () => {
  it("merges REST history with Yjs records", () => {
    const merged = mergeRestHistoryWithYjsRecords(
      [
        {
          id: 9,
          roomId: "r1",
          userId: "bob",
          content: "from rest",
          createdAt: "2026-01-01T00:01:00.000Z",
        },
      ],
      [
        {
          id: -1,
          roomId: "r1",
          userId: "alice",
          content: "from crdt",
          createdAt: "2026-01-01T00:03:00.000Z",
          clientMessageId: "cmsg_offline",
        },
      ],
    );
    expect(merged).toHaveLength(2);
    expect(merged.map((m) => m.id)).toEqual([9, -1]);
  });

  it("applies snapshot update into local doc", () => {
    resetRoomMessageCrdtDocsForTests();
    const remote = new Y.Doc();
    upsertMessageInDoc(remote, {
      id: 42,
      roomId: "r1",
      userId: "alice",
      content: "synced",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const update = Y.encodeStateAsUpdate(remote);
    let binary = "";
    for (let i = 0; i < update.byteLength; i += 1) {
      binary += String.fromCharCode(update[i]);
    }
    const local = new Y.Doc();
    applyCrdtSnapshotUpdate(local, btoa(binary));
    expect(readMessagesFromDoc(local)).toHaveLength(1);
  });

  it("prefers newer Yjs edit over REST row", () => {
    const doc = new Y.Doc();
    upsertMessageInDoc(doc, {
      id: 5,
      roomId: "r1",
      userId: "alice",
      content: "edited via crdt",
      createdAt: "2026-01-01T00:00:00.000Z",
      editedAt: "2026-01-01T00:05:00.000Z",
    });
    const merged = mergeRestHistoryWithYjsDoc(
      [
        {
          id: 5,
          roomId: "r1",
          userId: "alice",
          content: "original",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      doc,
    );
    expect(merged[0]?.content).toBe("edited via crdt");
  });

  it("detectConflictCandidatesFromMerge finds concurrent edit conflict", () => {
    const conflicts = detectConflictCandidatesFromMerge(
      [
        {
          id: 5,
          roomId: "r1",
          userId: "alice",
          content: "Offer from REST",
          createdAt: "2026-01-01T00:00:00.000Z",
          editedAt: "2026-01-01T00:00:01.000Z",
        },
      ],
      [
        {
          id: 5,
          roomId: "r1",
          userId: "alice",
          content: "Offer from Yjs peer",
          createdAt: "2026-01-01T00:00:00.000Z",
          editedAt: "2026-01-01T00:00:00.800Z",
        },
      ],
      "r1",
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.autoResolvable).toBe(false);
  });

  it("keeps Yjs tombstones over REST copies", () => {
    const doc = new Y.Doc();
    upsertMessageInDoc(doc, {
      id: 7,
      roomId: "r1",
      userId: "alice",
      content: "still here",
      createdAt: "2026-01-01T00:00:00.000Z",
      clientMessageId: "cmsg_7",
    });
    tombstoneMessageInDoc(doc, 7, "2026-01-01T00:04:00.000Z");
    const fromDoc = readMessagesFromDoc(doc);
    expect(fromDoc).toHaveLength(1);
    expect(fromDoc[0]?.deletedAt).toBe("2026-01-01T00:04:00.000Z");
    const merged = mergeRestHistoryWithYjsDoc(
      [
        {
          id: 7,
          roomId: "r1",
          userId: "alice",
          content: "still here",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      doc,
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.deletedAt).toBe("2026-01-01T00:04:00.000Z");
    expect(merged[0]?.content).toBe("[deleted]");
  });

  it("does not resurrect server ids omitted from REST history", () => {
    const merged = mergeRestHistoryWithYjsRecords(
      [
        {
          id: 8,
          roomId: "r1",
          userId: "bob",
          content: "kept",
          createdAt: "2026-01-01T00:02:00.000Z",
        },
      ],
      [
        {
          id: 7,
          roomId: "r1",
          userId: "alice",
          content: "should stay deleted",
          createdAt: "2026-01-01T00:01:00.000Z",
        },
      ],
    );
    expect(merged.map((m) => m.id)).toEqual([8]);
  });

  it("noop multi-tab sync when BroadcastChannel is unavailable", () => {
    const unsub = subscribeMessageCrdtMultiTabSync("r1", () => {});
    expect(typeof unsub).toBe("function");
    unsub();
  });
});
