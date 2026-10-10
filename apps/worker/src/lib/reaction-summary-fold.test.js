import { describe, expect, it } from "vitest";
import { applyReactionPlan, foldReactionSummary, planReactionMutation } from "./reaction-summary-fold.js";

function memoryReactionDb() {
  const rows = [];
  return {
    rows,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async run() {
              if (sql.startsWith("INSERT")) {
                rows.push({
                  project_id: args[0],
                  message_id: args[1],
                  room_id: args[2],
                  user_id: args[3],
                  emoji: args[4],
                });
                return;
              }
              const byEmoji = sql.includes("AND emoji");
              const next = rows.filter((row) => {
                const match =
                  row.project_id === args[0] &&
                  row.message_id === args[1] &&
                  row.room_id === args[2] &&
                  row.user_id === args[3] &&
                  (!byEmoji || row.emoji === args[4]);
                return !match;
              });
              rows.length = 0;
              rows.push(...next);
            },
            async first() {
              return (
                rows.find(
                  (row) =>
                    row.project_id === args[0] &&
                    row.message_id === args[1] &&
                    row.room_id === args[2] &&
                    row.user_id === args[3] &&
                    row.emoji === args[4],
                ) || null
              );
            },
          };
        },
      };
    },
  };
}

describe("FX-REAC-3 foldReactionSummary", () => {
  it("keeps unique as a set and multiple as counts", () => {
    const folded = foldReactionSummary(9, [
      { emoji: "👏", user_id: "ada" },
      { emoji: "👏", user_id: "ada" },
      { emoji: "👏", user_id: "lin" },
    ]);
    expect(folded.unique["👏"].total).toBe(2);
    expect(folded.multiple["👏"]).toMatchObject({
      total: 3,
      clientIds: { ada: 2, lin: 1 },
      totalClientIds: 2,
      clipped: false,
    });
  });

  it("FX-REAC-4 plans unique/distinct/multiple writes", () => {
    expect(planReactionMutation("add", { type: "unique", name: "👍" })).toMatchObject({
      deleteScope: "user",
      inserts: 1,
    });
    expect(planReactionMutation("add", { type: "distinct", name: "👍" }).insertIfMissing).toBe(true);
    expect(planReactionMutation("add", { type: "multiple", name: "👏", count: 3 }).inserts).toBe(3);
    expect(planReactionMutation("remove", { type: "unique" }).deleteScope).toBe("user");
    expect(planReactionMutation("remove", { type: "distinct" }).error).toMatch(/name required/);
  });

  it("FX-REAC-5 applyReactionPlan matches REST unique/distinct/multiple", async () => {
    const db = memoryReactionDb();
    const ctx = { projectId: "p", messageId: 1, roomId: "lobby", userId: "ada", now: "t", emoji: "👍" };
    await applyReactionPlan(db, ctx, planReactionMutation("add", { type: "distinct", name: "👍" }));
    await applyReactionPlan(db, ctx, planReactionMutation("add", { type: "distinct", name: "👍" }));
    expect(db.rows).toHaveLength(1);
    await applyReactionPlan(db, ctx, planReactionMutation("add", { type: "multiple", name: "👍", count: 2 }));
    expect(db.rows).toHaveLength(3);
    await applyReactionPlan(db, ctx, planReactionMutation("add", { type: "unique", name: "🔥" }));
    expect(db.rows.map((r) => r.emoji)).toEqual(["🔥"]);
  });
});
