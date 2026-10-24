/**
 * game-quest.js — the only game lib without a test.
 * Fake D1 mirrors the quests queries; fanout is mocked to assert the
 * "approved + room" side effect without a real room DO.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createGameQuest,
  listGameQuests,
  moderateGameQuest,
  scanQuestContent,
  updateGameQuestProgress,
} from "./game-quest.js";
import { fanoutServerEvent } from "./message-realtime-fanout.js";

vi.mock("./message-realtime-fanout.js", () => ({
  fanoutServerEvent: vi.fn(async () => {}),
}));

function mockDb() {
  const quests = new Map();
  const progress = [];
  const calls = [];
  return {
    quests,
    progress,
    calls,
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async run() {
              calls.push({ sql, params });
              if (sql.includes("INSERT INTO game_quests")) {
                const [id, project_id, room_id, title, description, objectives_json, moderation_status, moderation_reason, created_by, created_at, updated_at] = params;
                quests.set(id, {
                  id, project_id, room_id, title, description, objectives_json,
                  moderation_status, moderation_reason, created_by, created_at, updated_at,
                });
              } else if (sql.includes("INSERT INTO game_quest_progress")) {
                progress.push(params);
              } else if (sql.includes("UPDATE game_quests SET moderation_status")) {
                const [moderation_status, moderation_reason, updated_at, id, project_id] = params;
                const quest = quests.get(id);
                if (quest && quest.project_id === project_id) {
                  Object.assign(quest, { moderation_status, moderation_reason, updated_at });
                }
              }
              return { meta: { changes: 1 } };
            },
            async first() {
              const [id, project_id] = params;
              const quest = quests.get(id);
              if (!quest || quest.project_id !== project_id) return null;
              if (sql.includes("moderation_status = 'approved'") && quest.moderation_status !== "approved") return null;
              return quest;
            },
            async all() {
              calls.push({ sql, params });
              let results = [...quests.values()].filter((q) => q.project_id === params[0]);
              if (sql.includes("AND moderation_status = ?")) {
                results = results.filter((q) => q.moderation_status === params[1]);
              }
              return { results };
            },
          };
        },
      };
    },
  };
}

const auth = { projectId: "p1", userId: "u1" };

describe("scanQuestContent", () => {
  it("blocks cheat/economy/hate keywords and passes clean text", () => {
    expect(scanQuestContent("Find the key", "A gentle puzzle").ok).toBe(true);
    for (const text of ["Free aimbot here", "buy gold now", "sell account for real money", "nazi symbols"]) {
      const scan = scanQuestContent(text, "");
      expect(scan.ok).toBe(false);
      expect(scan.reason).toBe("blocked_content");
    }
  });
});

describe("createGameQuest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires a title", async () => {
    const db = mockDb();
    const result = await createGameQuest({ DB: db }, auth, { title: "   " });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("title_required");
    expect(db.quests.size).toBe(0);
  });

  it("approves a clean quest and fans out to the room", async () => {
    const db = mockDb();
    const result = await createGameQuest({ DB: db }, auth, {
      title: "Find the ancient key",
      description: "Explore the cave",
      roomId: "room_1",
      objectives: [{ id: "key", label: "Collect key" }],
    });
    expect(result.ok).toBe(true);
    expect(result.pendingModeration).toBe(false);
    expect(result.quest.moderationStatus).toBe("approved");
    expect(result.quest.objectives).toEqual([{ id: "key", label: "Collect key" }]);
    expect(fanoutServerEvent).toHaveBeenCalledTimes(1);
    expect(fanoutServerEvent).toHaveBeenCalledWith(
      expect.objectContaining({ DB: db }),
      expect.objectContaining({ projectId: "p1", roomId: "room_1", name: "game.quest_created" }),
    );
  });

  it("holds blocked content for moderation without fanout", async () => {
    const db = mockDb();
    const result = await createGameQuest({ DB: db }, auth, { title: "Get aimbot tips", roomId: "room_1" });
    expect(result.ok).toBe(true);
    expect(result.pendingModeration).toBe(true);
    expect(result.quest.moderationStatus).toBe("pending");
    expect(result.quest.moderationReason).toBe("blocked_content");
    expect(fanoutServerEvent).not.toHaveBeenCalled();
  });

  it("does not fan out an approved quest without a room", async () => {
    const db = mockDb();
    const result = await createGameQuest({ DB: db }, auth, { title: "Solo quest" });
    expect(result.ok).toBe(true);
    expect(fanoutServerEvent).not.toHaveBeenCalled();
  });
});

describe("listGameQuests", () => {
  it("scopes to the project, filters by status and clamps the limit", async () => {
    const db = mockDb();
    await createGameQuest({ DB: db }, auth, { title: "One" });
    await createGameQuest({ DB: db }, { ...auth, projectId: "p2" }, { title: "Other project" });
    await createGameQuest({ DB: db }, auth, { title: "Two hack" });

    const all = await listGameQuests({ DB: db }, auth);
    expect(all.quests).toHaveLength(2);

    const pending = await listGameQuests({ DB: db }, auth, { status: "pending", limit: 1000 });
    expect(pending.quests).toHaveLength(1);
    expect(pending.quests[0].title).toBe("Two hack");
    expect(db.calls.at(-1).params.at(-1)).toBe(100);
  });
});

describe("moderateGameQuest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an unknown decision or a missing quest", async () => {
    const db = mockDb();
    expect((await moderateGameQuest({ DB: db }, auth, "q1", "maybe")).error).toBe("invalid_decision");
    expect((await moderateGameQuest({ DB: db }, auth, "q1", "approve")).error).toBe("not_found");
  });

  it("approves a held quest and fans it out; rejects mark manual_reject", async () => {
    const db = mockDb();
    const created = await createGameQuest({ DB: db }, auth, { title: "Get aimbot", roomId: "room_1" });
    const approved = await moderateGameQuest({ DB: db }, auth, created.quest.id, "approve");
    expect(approved.ok).toBe(true);
    expect(approved.quest.moderationStatus).toBe("approved");
    expect(fanoutServerEvent).toHaveBeenCalledTimes(1);

    const rejected = await moderateGameQuest({ DB: db }, auth, created.quest.id, "reject");
    expect(rejected.quest.moderationStatus).toBe("rejected");
    expect(rejected.quest.moderationReason).toBe("manual_reject");
    expect(fanoutServerEvent).toHaveBeenCalledTimes(1);
  });
});

describe("updateGameQuestProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses a quest that is not approved", async () => {
    const db = mockDb();
    const created = await createGameQuest({ DB: db }, auth, { title: "Held aimbot", roomId: "room_1" });
    const result = await updateGameQuestProgress({ DB: db }, auth, created.quest.id, { completed: true });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("quest_not_available");
  });

  it("upserts progress (caller as default player) and fans out", async () => {
    const db = mockDb();
    const created = await createGameQuest({ DB: db }, auth, { title: "Find the key", roomId: "room_1" });
    vi.clearAllMocks();

    const result = await updateGameQuestProgress({ DB: db }, auth, created.quest.id, {
      progress: { keys: 1 },
      completed: true,
    });
    expect(result.ok).toBe(true);
    expect(result.playerId).toBe("u1");
    expect(db.progress).toHaveLength(1);
    expect(db.progress[0][4]).toBe(1); // completed → 1
    expect(fanoutServerEvent).toHaveBeenCalledWith(
      expect.objectContaining({ DB: db }),
      expect.objectContaining({ name: "game.quest_progress", roomId: "room_1", userId: "u1" }),
    );

    vi.clearAllMocks();
    await updateGameQuestProgress({ DB: db }, auth, created.quest.id, { playerId: "p9" });
    expect(db.progress[1][2]).toBe("p9");
    expect(db.progress[1][4]).toBe(0);
    expect(fanoutServerEvent).toHaveBeenCalledTimes(1);
  });
});
