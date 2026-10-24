import { describe, expect, it } from "vitest";
import { createTranscriptsApi } from "./transcripts.js";

function createEnv({ firstSequence = [], allResults = [] } = {}) {
  const calls = [];
  let firstIdx = 0;
  return {
    calls,
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            calls.push({ sql, args });
            return {
              run: async () => ({ meta: { changes: 1 } }),
              first: async () => firstSequence[firstIdx++] ?? null,
              all: async () => ({ results: allResults }),
            };
          },
        };
      },
    },
  };
}

describe("transcripts lib", () => {
  it("appends project-scoped entries and trims to maxPerUser", async () => {
    const env = createEnv({ firstSequence: [{ count: 3 }] });
    const api = createTranscriptsApi(env, { projectId: "p1", maxPerUser: 2 });
    const entry = await api.append({
      userKey: "u@example.com",
      role: "assistant",
      text: "hi",
      platform: "slack",
      threadId: "C1",
    });

    const insert = env.calls[0];
    expect(insert.sql).toContain("INSERT INTO user_transcripts");
    expect(insert.args[1]).toBe("p1");
    expect(insert.args[2]).toBe("u@example.com");
    expect(insert.args[3]).toBe("assistant");
    expect(insert.args[9]).toBeNull();
    expect(entry.id).toBeTruthy();
    expect(entry.text).toBe("hi");

    const trim = env.calls.find((c) => c.sql.startsWith("DELETE FROM user_transcripts WHERE project_id"));
    expect(trim.args).toEqual(["p1", "u@example.com", "p1", "u@example.com", 1]);
  });

  it("does not trim when under the cap", async () => {
    const env = createEnv({ firstSequence: [{ count: 2 }] });
    const api = createTranscriptsApi(env, { projectId: "p1", maxPerUser: 5 });
    await api.append({ userKey: "u", text: "hello" });
    expect(env.calls.some((c) => c.sql.startsWith("DELETE"))).toBe(false);
  });

  it("sets expires_at when retentionMs is configured", async () => {
    const env = createEnv({ firstSequence: [{ count: 1 }] });
    const api = createTranscriptsApi(env, { projectId: "p1", retentionMs: 60_000 });
    await api.append({ userKey: "u", text: "hello" });
    expect(typeof env.calls[0].args[9]).toBe("number");
  });

  it("lists newest entries oldest-first with project-scoped filters", async () => {
    const env = createEnv({
      allResults: [
        { id: "t1", user_key: "u", role: "user", text: "a", platform: "slack", thread_id: "C1", timestamp: 1, platform_message_id: null },
        { id: "t2", user_key: "u", role: "user", text: "b", platform: "slack", thread_id: "C1", timestamp: 2, platform_message_id: "m2" },
      ],
    });
    const api = createTranscriptsApi(env, { projectId: "p1" });
    const entries = await api.list({ userKey: "u", platforms: ["slack"], roles: ["user"], limit: 2 });

    const list = env.calls[0];
    expect(list.sql).toContain("FROM (SELECT * FROM user_transcripts WHERE project_id = ? AND user_key = ?");
    expect(list.sql).toContain("AND platform IN (?)");
    expect(list.sql).toContain("AND role IN (?)");
    expect(list.sql).toContain("ORDER BY timestamp ASC");
    expect(list.args).toEqual(["p1", "u", expect.any(Number), "slack", "user", 2]);
    expect(entries).toHaveLength(2);
    expect(entries[0].platformMessageId).toBeUndefined();
    expect(entries[1].platformMessageId).toBe("m2");
  });

  it("counts and deletes only the project's rows", async () => {
    const env = createEnv({ firstSequence: [{ count: 4 }, { count: 4 }] });
    const api = createTranscriptsApi(env, { projectId: "p1" });
    expect(await api.count({ userKey: "u" })).toBe(4);
    expect(env.calls[0].args).toEqual(["p1", "u", expect.any(Number)]);

    const del = await api.delete({ userKey: "u" });
    expect(del.deleted).toBe(4);
    const deleteCall = env.calls.find(
      (c) => c.sql.startsWith("DELETE FROM user_transcripts WHERE project_id = ? AND user_key = ?"),
    );
    expect(deleteCall.args).toEqual(["p1", "u"]);
  });
});
