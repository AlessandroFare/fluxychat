import { describe, it, expect } from "vitest";
import {
  expandMentions,
  listMentionSuggestions,
  mentionHandlesForAgentInvoke,
  normalizeMentionToken,
} from "./message-mentions.js";

function mockEnv(members) {
  return {
    DB: {
      prepare: (sql) => ({
        bind: (...args) => ({
          all: () => {
            if (sql.includes("room_members")) {
              return Promise.resolve({ results: members });
            }
            return Promise.resolve({ results: [] });
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
