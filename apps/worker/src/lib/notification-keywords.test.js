import { describe, expect, it } from "vitest";
import {
  addNotificationKeyword,
  keywordMatchesContent,
  listNotificationKeywords,
  matchNotificationKeywordUsers,
  normalizeNotificationKeyword,
  removeNotificationKeyword,
} from "./notification-keywords.js";

function createEnv(seed = []) {
  const rows = seed.map((row) => ({ ...row }));
  return {
    rows,
    env: {
      DB: {
        prepare(sql) {
          return {
            bind(...args) {
              return {
                async run() {
                  if (sql.includes("INSERT OR IGNORE INTO user_notification_keywords")) {
                    const [id, projectId, userId, word, createdAt] = args;
                    if (
                      !rows.some(
                        (r) => r.project_id === projectId && r.user_id === userId && r.word === word,
                      )
                    ) {
                      rows.push({ id, project_id: projectId, user_id: userId, word, created_at: createdAt });
                    }
                  } else if (sql.includes("DELETE FROM user_notification_keywords")) {
                    const [projectId, userId, word] = args;
                    for (let i = rows.length - 1; i >= 0; i -= 1) {
                      const row = rows[i];
                      if (row.project_id === projectId && row.user_id === userId && row.word === word) {
                        rows.splice(i, 1);
                      }
                    }
                  }
                  return { meta: {} };
                },
                async first() {
                  if (sql.includes("COUNT(*)")) {
                    return {
                      c: rows.filter(
                        (row) => row.project_id === args[0] && row.user_id === args[1],
                      ).length,
                    };
                  }
                  return null;
                },
                async all() {
                  if (sql.includes("SELECT user_id, word")) {
                    return {
                      results: rows
                        .filter((row) => row.project_id === args[0])
                        .map((row) => ({ user_id: row.user_id, word: row.word })),
                    };
                  }
                  if (sql.includes("SELECT word")) {
                    return {
                      results: rows
                        .filter((row) => row.project_id === args[0] && row.user_id === args[1])
                        .map((row) => ({ word: row.word, created_at: row.created_at })),
                    };
                  }
                  return { results: [] };
                },
              };
            },
          };
        },
      },
    },
  };
}

describe("notification-keywords", () => {
  it("normalizes and matches whole words only", () => {
    expect(normalizeNotificationKeyword("  Deploy   NOW ")).toBe("deploy now");
    expect(keywordMatchesContent("please deploy now thanks", "deploy now")).toBe(true);
    expect(keywordMatchesContent("deployment pipeline", "deploy")).toBe(false);
    expect(keywordMatchesContent("check the RELEASE", "release")).toBe(true);
    expect(keywordMatchesContent("x", "")).toBe(false);
  });

  it("adds (idempotent), lists, removes", async () => {
    const { env, rows } = createEnv();
    expect((await addNotificationKeyword(env, { projectId: "p1", userId: "u1", word: "Outage" })).ok).toBe(true);
    await addNotificationKeyword(env, { projectId: "p1", userId: "u1", word: "outage" });
    expect(rows).toHaveLength(1);
    expect(
      (await listNotificationKeywords(env, { projectId: "p1", userId: "u1" })).keywords.map((k) => k.word),
    ).toEqual(["outage"]);
    await removeNotificationKeyword(env, { projectId: "p1", userId: "u1", word: "OUTAGE" });
    expect(rows).toHaveLength(0);
    expect(
      (await addNotificationKeyword(env, { projectId: "p1", userId: "u1", word: "   " })).ok,
    ).toBe(false);
  });

  it("matches watchers scoped to room members and excludes the author", async () => {
    const { env } = createEnv([
      { id: "k1", project_id: "p1", user_id: "u1", word: "deploy", created_at: "x" },
      { id: "k2", project_id: "p1", user_id: "u2", word: "deploy", created_at: "x" },
      { id: "k3", project_id: "p1", user_id: "u3", word: "incident", created_at: "x" },
      { id: "k4", project_id: "p1", user_id: "u4", word: "deploy", created_at: "x" },
    ]);
    const hits = await matchNotificationKeywordUsers(env, {
      projectId: "p1",
      content: "we deploy at noon",
      excludeUserId: "u1",
      memberIds: ["u1", "u2", "u3"],
    });
    expect(hits).toEqual(["u2"]);
    expect(
      await matchNotificationKeywordUsers(env, {
        projectId: "p1",
        content: "nice",
        excludeUserId: null,
        memberIds: ["u1"],
      }),
    ).toEqual([]);
  });
});
