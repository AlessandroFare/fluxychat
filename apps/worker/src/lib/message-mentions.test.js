import { describe, it, expect } from "vitest";
import {
  expandMentions,
  listMentionSuggestions,
  mentionHandlesForAgentInvoke,
  normalizeMentionToken,
} from "./message-mentions.js";

function mockEnv(members, groups = {}) {
  return {
    DB: {
      prepare: (sql) => ({
        bind: (...args) => ({
          all: () => {
            if (sql.includes("room_members")) {
              return Promise.resolve({ results: members });
            }
            if (sql.includes("FROM user_group_members")) {
              return Promise.resolve({
                results: (groups[args[0]] || []).map((user_id) => ({ user_id })),
              });
            }
            if (sql.includes("FROM user_groups") && sql.includes("ORDER BY name")) {
              return Promise.resolve({ results: Object.keys(groups).map((name) => ({ name })) });
            }
            return Promise.resolve({ results: [] });
          },
          first: () => {
            if (sql.includes("FROM user_groups") && sql.includes("name = ?")) {
              return Promise.resolve(groups[args[1]] ? { id: args[1] } : null);
            }
            return Promise.resolve(null);
          },
        }),
      }),
    },
  };
}

describe("message-mentions", () => {
  it("normalizes role aliases", () => {
    expect(normalizeMentionToken("admins")).toBe("role:admin");
    expect(normalizeMentionToken("here")).toBe("here");
    expect(normalizeMentionToken("Group:Design")).toBe("group:design");
  });

  it("expands @channel to all members except author", async () => {
    const env = mockEnv([
      { user_id: "u1", role: "member" },
      { user_id: "u2", role: "admin" },
      { user_id: "u3", role: "member" },
    ]);
    const out = await expandMentions(env, {
      projectId: "p1",
      roomId: "r1",
      authorUserId: "u1",
      tokens: ["channel"],
    });
    expect(out.sort()).toEqual(["u2", "u3"]);
  });

  it("expands @here to online users when provided", async () => {
    const env = mockEnv([
      { user_id: "u1", role: "member" },
      { user_id: "u2", role: "member" },
      { user_id: "u3", role: "member" },
    ]);
    const out = await expandMentions(env, {
      projectId: "p1",
      roomId: "r1",
      authorUserId: "u1",
      tokens: ["here"],
      onlineUserIds: ["u1", "u2"],
    });
    expect(out).toEqual(["u2"]);
  });

  it("keeps @assistant handles for agent invoke after expandMentions would drop them", () => {
    expect(mentionHandlesForAgentInvoke(["assistant", "here", "channel", "u2"])).toEqual([
      "assistant",
      "u2",
    ]);
    expect(mentionHandlesForAgentInvoke(["group:design", "assistant"])).toEqual(["assistant"]);
  });

  it("expands @group:<name> to room members only", async () => {
    const env = mockEnv(
      [
        { user_id: "u1", role: "member" },
        { user_id: "u2", role: "member" },
        { user_id: "u3", role: "member" },
      ],
      { design: ["u1", "u2", "outsider"] },
    );
    const out = await expandMentions(env, {
      projectId: "p1",
      roomId: "r1",
      authorUserId: "u1",
      tokens: ["group:Design"],
    });
    expect(out).toEqual(["u2"]);
  });

  it("suggests user groups in mention autocomplete", async () => {
    const env = mockEnv([{ user_id: "alice", role: "member" }], { design: ["alice"] });
    const suggestions = await listMentionSuggestions(env, {
      projectId: "p1",
      roomId: "r1",
      query: "group:des",
    });
    expect(suggestions.some((s) => s.id === "group:design")).toBe(true);
  });

  it("lists mention suggestions", async () => {
    const env = mockEnv([{ user_id: "alice", role: "member" }]);
    const suggestions = await listMentionSuggestions(env, {
      projectId: "p1",
      roomId: "r1",
      query: "here",
    });
    expect(suggestions.some((s) => s.id === "here")).toBe(true);
  });
});
