import { describe, expect, it } from "vitest";
import {
  isValidSlackUserId,
  getFluxyUserIdForSlackUser,
  upsertHitlSlackUserMap,
  listHitlSlackUserMap,
} from "./hitl-slack-user-map.js";

function makeDb() {
  const rows = new Map();
  return {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async first() {
              if (sql.includes("SELECT fluxy_user_id")) {
                const key = `${params[0]}:${params[1]}`;
                return rows.get(key) ? { fluxy_user_id: rows.get(key).fluxy_user_id } : null;
              }
              return null;
            },
            async all() {
              const projectId = params[0];
              const onlyUser = sql.includes("AND fluxy_user_id") ? params[1] : null;
              const results = [];
              for (const [key, row] of rows) {
                if (!key.startsWith(`${projectId}:`)) continue;
                if (onlyUser && row.fluxy_user_id !== onlyUser) continue;
                results.push({
                  slack_user_id: row.slack_user_id,
                  fluxy_user_id: row.fluxy_user_id,
                  updated_at: row.updated_at,
                });
              }
              return { results };
            },
            async run() {
              if (sql.includes("INSERT INTO hitl_slack_user_map")) {
                const [projectId, slackUserId, fluxyUserId, createdAt, updatedAt] = params;
                rows.set(`${projectId}:${slackUserId}`, {
                  slack_user_id: slackUserId,
                  fluxy_user_id: fluxyUserId,
                  created_at: createdAt,
                  updated_at: updatedAt,
                });
              }
              return { success: true };
            },
          };
        },
      };
    },
  };
}

describe("hitl-slack-user-map", () => {
  it("accepts Slack user ids", () => {
    expect(isValidSlackUserId("U01234567")).toBe(true);
    expect(isValidSlackUserId("W0ABCDEF")).toBe(true);
    expect(isValidSlackUserId("not slack")).toBe(false);
  });

  it("round-trips a mapping", async () => {
    const env = { DB: makeDb() };
    await upsertHitlSlackUserMap(env, "proj_1", "U01234567", "user_ana");
    expect(await getFluxyUserIdForSlackUser(env, "proj_1", "U01234567")).toBe("user_ana");
    const list = await listHitlSlackUserMap(env, "proj_1");
    expect(list).toHaveLength(1);
    expect(list[0].slackUserId).toBe("U01234567");
  });
});
