import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  FLUXY_GAME_CHECKPOINTS_MAP_KEY,
  mergeRestCheckpointWithYjsRecord,
  readCheckpointsFromDoc,
  shouldPreferCheckpoint,
  upsertCheckpointInDoc,
} from "./yjs-game-checkpoint.js";

describe("yjs-game-checkpoint", () => {
  it("upserts checkpoint keyed by player and key", () => {
    const doc = new Y.Doc();
    upsertCheckpointInDoc(doc, {
      checkpointKey: "level-1",
      playerId: "alice",
      state: { hp: 90 },
      version: 2,
      updatedAt: "2026-01-01T00:01:00.000Z",
    });
    expect(doc.getMap(FLUXY_GAME_CHECKPOINTS_MAP_KEY).has("alice:level-1")).toBe(true);
    expect(readCheckpointsFromDoc(doc)).toHaveLength(1);
  });

  it("prefers higher version on conflict", () => {
    const older = { version: 1, updatedAt: "2026-01-01T00:00:00.000Z" };
    const newer = { version: 3, updatedAt: "2026-01-01T00:00:00.000Z" };
    expect(shouldPreferCheckpoint(older, newer)).toBe(true);
    expect(shouldPreferCheckpoint(newer, older)).toBe(false);
  });

  it("merges state from yjs when yjs version wins", () => {
    const merged = mergeRestCheckpointWithYjsRecord(
      {
        checkpointKey: "level-1",
        playerId: "alice",
        state: { hp: 50, coins: 5 },
        version: 2,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        checkpointKey: "level-1",
        playerId: "alice",
        state: { hp: 80, quest: "cave" },
        version: 3,
        updatedAt: "2026-01-01T00:01:00.000Z",
      },
    );
    expect(merged?.version).toBe(3);
    expect(merged?.state).toEqual({ hp: 80, coins: 5, quest: "cave" });
  });
});
