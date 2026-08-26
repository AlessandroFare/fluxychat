import { describe, expect, it } from "vitest";
import {
  createFeedMessage,
  createRoomFeed,
  listFeedMessages,
  listRoomFeeds,
  sanitizeFeedKind,
  sanitizeFeedMessageMetadata,
} from "./room-feeds.js";

function createEnv() {
  const feeds = [];
  const messages = [];
  return {
    env: {
      DB: {
        prepare(sql) {
          return {
            bind(...args) {
              return {
                async run() {
                  if (sql.includes("INSERT INTO room_feeds")) {
                    feeds.push({
                      id: args[0],
                      project_id: args[1],
                      room_id: args[2],
                      name: args[3],
                      kind: args[4],
                      created_by: args[5],
                      created_at: args[6],
                      updated_at: args[7],
                    });
                  } else if (sql.includes("INSERT INTO room_feed_messages")) {
                    messages.push({
                      id: args[0],
                      feed_id: args[1],
                      project_id: args[2],
                      room_id: args[3],
                      user_id: args[4],
                      body: args[5],
                      metadata: args[6],
                      created_at: args[7],
                    });
                  } else if (sql.includes("UPDATE room_feeds SET updated_at")) {
                    const row = feeds.find((f) => f.id === args[1]);
                    if (row) row.updated_at = args[0];
                  }
                  return { success: true };
                },
                async first() {
                  if (sql.includes("FROM room_feeds WHERE id")) {
                    return (
                      feeds.find(
                        (f) => f.id === args[0] && f.project_id === args[1] && f.room_id === args[2],
                      ) || null
                    );
                  }
                  return null;
                },
                async all() {
                  if (sql.includes("FROM room_feeds")) {
                    return {
                      results: feeds.filter(
                        (f) => f.project_id === args[0] && f.room_id === args[1],
                      ),
                    };
                  }
                  if (sql.includes("FROM room_feed_messages")) {
                    return {
                      results: messages.filter(
                        (m) =>
                          m.feed_id === args[0] &&
                          m.project_id === args[1] &&
                          m.room_id === args[2],
                      ),
                    };
                  }
                  return { results: [] };
                },
              };
            },
          };
        },
      },
      ROOM: {
        idFromName: () => ({}),
        get: () => ({ fetch: async () => new Response(null, { status: 204 }) }),
      },
    },
  };
}

describe("room-feeds", () => {
  it("allowlists kind and metadata", () => {
    expect(sanitizeFeedKind("agent")).toBe("agent");
    expect(sanitizeFeedKind("nope")).toBe("activity");
    expect(sanitizeFeedMessageMetadata({ source: "n8n", xss: "<script>" })).toEqual({
      source: "n8n",
    });
  });

  it("creates a feed and appends messages", async () => {
    const { env } = createEnv();
    const created = await createRoomFeed(env, {
      projectId: "p1",
      roomId: "r1",
      userId: "workflow",
      name: "Agent traces",
      kind: "agent",
    });
    expect(created.ok).toBe(true);
    const listed = await listRoomFeeds(env, { projectId: "p1", roomId: "r1" });
    expect(listed).toHaveLength(1);
    expect(listed[0].kind).toBe("agent");

    const added = await createFeedMessage(env, {
      projectId: "p1",
      roomId: "r1",
      feedId: created.feed.id,
      userId: "workflow",
      body: "run started",
      metadata: { source: "n8n", status: "ok" },
    });
    expect(added.ok).toBe(true);
    const msgs = await listFeedMessages(env, {
      projectId: "p1",
      roomId: "r1",
      feedId: created.feed.id,
    });
    expect(msgs.ok).toBe(true);
    expect(msgs.messages).toHaveLength(1);
    expect(msgs.messages[0].metadata.source).toBe("n8n");
  });

  it("rejects empty names and unknown feeds", async () => {
    const { env } = createEnv();
    expect((await createRoomFeed(env, { projectId: "p1", roomId: "r1", userId: "u", name: "  " })).ok).toBe(
      false,
    );
    const missing = await createFeedMessage(env, {
      projectId: "p1",
      roomId: "r1",
      feedId: "feed_missing",
      userId: "u",
      body: "hi",
    });
    expect(missing.error).toBe("feed_not_found");
  });
});
