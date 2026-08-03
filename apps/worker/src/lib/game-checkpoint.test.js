import { describe, expect, it } from "vitest";
import { upsertGameCheckpoint, federateGameCheckpoint } from "./game-checkpoint.js";
import { createGameQuest, scanQuestContent } from "./game-quest.js";

function checkpointEnv(existing = null) {
  const rows = new Map();
  if (existing) {
    rows.set(`${existing.project_id}:${existing.player_id}:${existing.checkpoint_key}`, { ...existing });
  }
  return {
    DB: {
      prepare(sql) {
        return {
          bind(...params) {
            return {
              async first() {
                if (sql.includes("FROM game_checkpoints")) {
                  const [projectId, playerId, key] = params;
                  return rows.get(`${projectId}:${playerId}:${key}`) ?? null;
                }
                return null;
              },
              async run() {
                if (sql.includes("INSERT INTO game_checkpoints")) {
                  const [projectId, playerId, key, stateJson, version, updatedAt] = params;
                  rows.set(`${projectId}:${playerId}:${key}`, {
                    project_id: projectId,
                    player_id: playerId,
                    checkpoint_key: key,
                    state_json: stateJson,
                    version,
                    updated_at: updatedAt,
                  });
                }
                return { meta: { changes: 1 } };
              },
            };
          },
        };
      },
    },
    rows,
  };
}

function questEnv() {
  const quests = [];
  return {
    DB: {
      prepare(sql) {
        return {
          bind(...params) {
            return {
              async first() {
                if (sql.includes("FROM game_quests")) {
                  return quests.find((q) => q.id === params[0]) ?? null;
                }
                return null;
              },
              async run() {
                if (sql.includes("INSERT INTO game_quests")) {
                  quests.push({
                    id: params[0],
                    project_id: params[1],
                    room_id: params[2],
                    title: params[3],
                    description: params[4],
                    objectives_json: params[5],
                    moderation_status: params[6],
                    moderation_reason: params[7],
                    created_by: params[8],
                    created_at: params[9],
                    updated_at: params[10],
                  });
                }
                return { meta: { changes: 1 } };
              },
            };
          },
        };
      },
    },
    quests,
  };
}

describe("game-checkpoint", () => {
  it("creates checkpoint at version 1", async () => {
    const env = checkpointEnv();
    const auth = { projectId: "p1", userId: "alice" };
    const result = await upsertGameCheckpoint(env, auth, {
      checkpointKey: "level-3",
      state: { hp: 80, coins: 12 },
    });
    expect(result.ok).toBe(true);
    expect(result.checkpoint.version).toBe(1);
    expect(result.checkpoint.state.hp).toBe(80);
  });

  it("returns version_conflict when expectedVersion mismatches", async () => {
    const env = checkpointEnv({
      project_id: "p1",
      player_id: "alice",
      checkpoint_key: "level-3",
      state_json: '{"hp":50}',
      version: 2,
    });
    const auth = { projectId: "p1", userId: "alice" };
    const result = await upsertGameCheckpoint(env, auth, {
      checkpointKey: "level-3",
      state: { hp: 90 },
      expectedVersion: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("version_conflict");
    expect(result.conflict).toBe(true);
  });

  it("federate requires source and target rooms", async () => {
    const env = checkpointEnv();
    const auth = { projectId: "p1", userId: "alice" };
    const result = await federateGameCheckpoint(env, auth, { checkpointKey: "level-3" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("checkpoint_source_target_required");
  });
});

describe("game-quest", () => {
  it("scanQuestContent blocks cheat keywords", () => {
    expect(scanQuestContent("Free aimbot download", "").ok).toBe(false);
    expect(scanQuestContent("Collect 10 gems", "Explore the cave").ok).toBe(true);
  });

  it("createGameQuest auto-approves clean quests", async () => {
    const env = questEnv();
    const auth = { projectId: "p1", userId: "host" };
    const result = await createGameQuest(env, auth, {
      title: "Find the ancient key",
      roomId: "game-room",
      objectives: [{ id: "key", label: "Find key" }],
    });
    expect(result.ok).toBe(true);
    expect(result.quest.moderationStatus).toBe("approved");
    expect(result.pendingModeration).toBeFalsy();
  });

  it("createGameQuest holds flagged quests for moderation", async () => {
    const env = questEnv();
    const auth = { projectId: "p1", userId: "host" };
    const result = await createGameQuest(env, auth, {
      title: "Buy gold fast",
      description: "Real money trade",
    });
    expect(result.ok).toBe(true);
    expect(result.quest.moderationStatus).toBe("pending");
    expect(result.pendingModeration).toBe(true);
  });
});
