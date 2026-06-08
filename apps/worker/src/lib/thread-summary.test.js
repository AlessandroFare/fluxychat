import { describe, expect, it, vi } from "vitest";
import {
  MIN_THREAD_MESSAGES,
  buildThreadTranscript,
  collectThreadMessages,
  summarizeThread,
} from "./thread-summary.js";

describe("thread-summary", () => {
  it("collectThreadMessages walks up to root and gathers replies", async () => {
    const env = createThreadEnv();
    const collected = await collectThreadMessages(env, {
      projectId: "proj_1",
      roomId: "room_1",
      messageId: 3,
    });
    expect(collected.ok).toBe(true);
    expect(collected.rootId).toBe(1);
    expect(collected.messages).toHaveLength(3);
    expect(collected.messages[0].id).toBe(1);
  });

  it("buildThreadTranscript formats participants", () => {
    const text = buildThreadTranscript([
      { userId: "alice", content: "Need help with billing" },
      { userId: "bob", content: "I can take a look" },
    ]);
    expect(text).toContain("alice:");
    expect(text).toContain("bob:");
  });

  it("summarizeThread rejects short threads", async () => {
    const env = createThreadEnv();
    const result = await summarizeThread(env, {
      projectId: "proj_1",
      roomId: "room_1",
      messageId: 99,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("thread_too_short");
    expect(result.messageCount).toBe(1);
    expect(result.minRequired).toBe(MIN_THREAD_MESSAGES);
  });

  it("summarizeThread returns AI bullets for long threads", async () => {
    const env = createThreadEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content:
                  "- Customer asked about refund\n- Agent approved partial credit\n- Follow up by Friday",
              },
            },
          ],
        }),
      })),
    );

    const result = await summarizeThread(env, {
      projectId: "proj_1",
      roomId: "room_1",
      messageId: 2,
    });
    expect(result.ok).toBe(true);
    expect(result.summary).toContain("refund");
    expect(result.messageCount).toBe(3);
    expect(result.rootMessageId).toBe(1);

    vi.unstubAllGlobals();
  });
});

function createThreadEnv() {
  const messages = [
    {
      id: 1,
      project_id: "proj_1",
      room_id: "room_1",
      user_id: "alice",
      content: "How do refunds work?",
      created_at: "2026-06-08T10:00:00.000Z",
      parent_id: null,
      deleted_at: null,
    },
    {
      id: 2,
      project_id: "proj_1",
      room_id: "room_1",
      user_id: "bob",
      content: "We can offer store credit.",
      created_at: "2026-06-08T10:01:00.000Z",
      parent_id: 1,
      deleted_at: null,
    },
    {
      id: 3,
      project_id: "proj_1",
      room_id: "room_1",
      user_id: "alice",
      content: "That works, thanks!",
      created_at: "2026-06-08T10:02:00.000Z",
      parent_id: 1,
      deleted_at: null,
    },
    {
      id: 99,
      project_id: "proj_1",
      room_id: "room_1",
      user_id: "carol",
      content: "Standalone note",
      created_at: "2026-06-08T11:00:00.000Z",
      parent_id: null,
      deleted_at: null,
    },
  ];

  return {
    AI_BASE_URL: "https://llm.example.com",
    AI_API_KEY: "sk-test",
    DB: {
      prepare(sql) {
        return {
          bind(...binds) {
            return {
              first: async () => {
                if (sql.includes("WHERE project_id = ? AND room_id = ? AND id = ?")) {
                  const [projectId, roomId, id] = binds;
                  return (
                    messages.find(
                      (m) =>
                        m.project_id === projectId &&
                        m.room_id === roomId &&
                        m.id === Number(id) &&
                        !m.deleted_at,
                    ) ?? null
                  );
                }
                return null;
              },
              all: async () => {
                if (sql.includes("parent_id IN")) {
                  const projectId = binds[0];
                  const roomId = binds[1];
                  const parentIds = binds.slice(2).map(Number);
                  return {
                    results: messages.filter(
                      (m) =>
                        m.project_id === projectId &&
                        m.room_id === roomId &&
                        parentIds.includes(m.parent_id) &&
                        !m.deleted_at,
                    ),
                  };
                }
                if (sql.includes("id IN")) {
                  const projectId = binds[0];
                  const roomId = binds[1];
                  const ids = binds.slice(2).map(Number);
                  return {
                    results: messages
                      .filter(
                        (m) =>
                          m.project_id === projectId &&
                          m.room_id === roomId &&
                          ids.includes(m.id) &&
                          !m.deleted_at,
                      )
                      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
                  };
                }
                return { results: [] };
              },
            };
          },
        };
      },
    },
  };
}
