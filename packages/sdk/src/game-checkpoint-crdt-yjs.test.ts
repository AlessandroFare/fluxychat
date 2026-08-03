import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  applyGameCheckpointCrdtUpdate,
  mergeRestCheckpointWithYjsRecord,
  mergeSingleCheckpointWithYjsDoc,
  readCheckpointsFromDoc,
  resetRoomGameCheckpointDocsForTests,
  upsertCheckpointInDoc,
} from "./game-checkpoint-crdt-yjs";

describe("game-checkpoint-crdt-yjs", () => {
  it("merges yjs checkpoint over older d1 row", () => {
    const merged = mergeRestCheckpointWithYjsRecord(
      {
        checkpointKey: "demo",
        playerId: "alice",
        state: { coins: 1 },
        version: 1,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        checkpointKey: "demo",
        playerId: "alice",
        state: { hp: 100 },
        version: 2,
        updatedAt: "2026-01-01T00:01:00.000Z",
      },
    );
    expect(merged?.version).toBe(2);
    expect(merged?.state).toEqual({ coins: 1, hp: 100 });
  });

  it("applies snapshot into local doc", () => {
    resetRoomGameCheckpointDocsForTests();
    const remote = new Y.Doc();
    upsertCheckpointInDoc(remote, {
      checkpointKey: "lvl",
      playerId: "bob",
      state: { x: 1 },
      version: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const update = Y.encodeStateAsUpdate(remote);
    let binary = "";
    for (let i = 0; i < update.byteLength; i += 1) binary += String.fromCharCode(update[i]);
    const local = new Y.Doc();
    applyGameCheckpointCrdtUpdate(local, btoa(binary));
    expect(readCheckpointsFromDoc(local)).toHaveLength(1);
  });

  it("mergeSingleCheckpointWithYjsDoc picks newer version", () => {
    const doc = new Y.Doc();
    upsertCheckpointInDoc(doc, {
      checkpointKey: "lvl",
      playerId: "bob",
      state: { hp: 50 },
      version: 4,
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const merged = mergeSingleCheckpointWithYjsDoc(
      {
        checkpointKey: "lvl",
        playerId: "bob",
        state: { hp: 10 },
        version: 3,
        updatedAt: "2026-01-01T00:01:00.000Z",
      },
      doc,
      "bob",
      "lvl",
    );
    expect(merged?.version).toBe(4);
  });
});
