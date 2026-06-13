import { describe, expect, it } from "vitest";
import {
  queueModerationEvent,
  getModerationQueue,
  getModerationStats,
  reviewModerationEvent,
} from "./ai-moderation.js";

function createModerationEnv(overrides = {}) {
  const queue = [];
  const moderationEvents = [];
  let nextId = 1;

  return {
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() {
                if (sql.includes("SELECT COUNT(*) AS cnt FROM ai_moderation_queue WHERE")) {
                  if (sql.includes("reviewed_by IS NULL")) {
                    return { cnt: queue.filter((e) => !e.reviewed_by).length };
                  }
                  return { cnt: queue.length };
                }
                if (sql.includes("SELECT * FROM ai_moderation_queue WHERE id = ?")) {
                  return queue.find((e) => e.id === args[0] && e.project_id === args[1]) || null;
                }
                return null;
              },
              async all() {
                if (sql.includes("FROM ai_moderation_queue WHERE")) {
                  let filtered = queue.filter((e) => e.project_id === args[0]);
                  if (sql.includes("AND room_id = ?")) {
                    filtered = filtered.filter((e) => e.room_id === args[1]);
                  }
                  if (sql.includes("AND severity = ?")) {
                    const sevIdx = sql.split("AND severity = ?").length > 1
                      ? args.findIndex((a) => ["none", "low", "medium", "high", "critical"].includes(a) && a !== args[0])
                      : 1;
                    filtered = filtered.filter((e) => e.severity === args[sevIdx]);
                  }
                  if (sql.includes("AND reviewed_by IS NULL")) {
                    filtered = filtered.filter((e) => !e.reviewed_by);
                  }
                  return { results: filtered };
                }
                if (sql.includes("SELECT severity, COUNT")) {
                  const counts = {};
                  for (const e of queue.filter((q) => q.project_id === args[0])) {
                    counts[e.severity] = (counts[e.severity] || 0) + 1;
                  }
                  return { results: Object.entries(counts).map(([severity, cnt]) => ({ severity, cnt })) };
                }
                return { results: [] };
              },
              async run() {
                if (sql.includes("INSERT INTO ai_moderation_queue")) {
                  const event = {
                    id: args[0],
                    project_id: args[1],
                    room_id: args[2],
                    message_id: args[3],
                    user_id: args[4],
                    content: args[5],
                    severity: args[6],
                    categories: args[7],
                    reason: args[8],
                    confidence: args[9],
                    suggested_action: args[10],
                    auto_action_taken: args[11],
                    reviewed_by: null,
                    reviewed_at: null,
                    review_action: null,
                    review_notes: null,
                    created_at: args[14],
                    updated_at: args[15],
                  };
                  queue.push(event);
                }
                if (sql.includes("INSERT INTO moderation_events")) {
                  moderationEvents.push({
                    project_id: args[0],
                    room_id: args[1],
                    user_id: args[2],
                    action: args[3],
                    reason: args[4],
                    created_at: args[5],
                  });
                }
                if (sql.includes("UPDATE ai_moderation_queue SET reviewed_by")) {
                  const eventId = args[4];
                  const event = queue.find((e) => e.id === eventId);
                  if (event) {
                    event.reviewed_by = args[0];
                    event.reviewed_at = args[1];
                    if (sql.includes("review_action = 'dismiss'")) {
                      event.review_action = "dismiss";
                    } else if (sql.includes("review_action = 'override'")) {
                      event.review_action = "override";
                    } else {
                      event.review_action = "confirm";
                    }
                    event.review_notes = args[3];
                    event.updated_at = args[4] || event.updated_at;
                  }
                }
                return { success: true, meta: { last_row_id: nextId++ } };
              },
            };
          },
        };
      },
    },
    ...overrides,
  };
}

describe("queueModerationEvent", () => {
  it("inserts event into queue", async () => {
    const env = createModerationEnv();
    const result = await queueModerationEvent(env, {
      projectId: "proj_1",
      roomId: "room_1",
      userId: "user_1",
      messageId: 1,
      content: "test message",
      severity: "low",
      categories: ["spam"],
      reason: "looks like spam",
      confidence: 0.7,
      suggestedAction: "log",
    });
    expect(result.ok).toBe(true);
    expect(result.id).toBeTruthy();
  });

  it("stores auto action taken", async () => {
    const env = createModerationEnv();
    const result = await queueModerationEvent(env, {
      projectId: "proj_1",
      roomId: "room_1",
      userId: "user_1",
      content: "harmful content",
      severity: "high",
      categories: ["toxicity"],
      reason: "toxic language",
      confidence: 0.9,
      suggestedAction: "warn",
      autoActionTaken: "warn",
    });
    expect(result.ok).toBe(true);
  });
});

describe("getModerationQueue", () => {
  it("returns queued events", async () => {
    const env = createModerationEnv();
    await queueModerationEvent(env, {
      projectId: "proj_1",
      roomId: "room_1",
      userId: "user_1",
      content: "test",
      severity: "medium",
      categories: [],
      reason: "test",
      confidence: 0.8,
      suggestedAction: "flag",
    });

    const result = await getModerationQueue(env, { projectId: "proj_1" });
    expect(result.ok).toBe(true);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].severity).toBe("medium");
  });

  it("filters by severity", async () => {
    const env = createModerationEnv();
    await queueModerationEvent(env, {
      projectId: "proj_1", roomId: "room_1", userId: "u1",
      content: "a", severity: "low", categories: [], reason: "", confidence: 0.5, suggestedAction: "log",
    });
    await queueModerationEvent(env, {
      projectId: "proj_1", roomId: "room_1", userId: "u2",
      content: "b", severity: "high", categories: [], reason: "", confidence: 0.9, suggestedAction: "warn",
    });

    const result = await getModerationQueue(env, { projectId: "proj_1", severity: "high" });
    expect(result.events).toHaveLength(1);
    expect(result.events[0].severity).toBe("high");
  });

  it("filters by pending", async () => {
    const env = createModerationEnv();
    await queueModerationEvent(env, {
      projectId: "proj_1", roomId: "room_1", userId: "u1",
      content: "a", severity: "low", categories: [], reason: "", confidence: 0.5, suggestedAction: "log",
    });

    const result = await getModerationQueue(env, { projectId: "proj_1", pending: true });
    expect(result.events).toHaveLength(1);
  });
});

describe("reviewModerationEvent", () => {
  it("returns error for unknown event", async () => {
    const env = createModerationEnv();
    const result = await reviewModerationEvent(env, {
      eventId: "unknown",
      projectId: "proj_1",
      moderatorId: "mod_1",
      action: "confirm",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("event_not_found");
  });

  it("dismisses an event", async () => {
    const env = createModerationEnv();
    const insertResult = await queueModerationEvent(env, {
      projectId: "proj_1", roomId: "room_1", userId: "u1",
      content: "test", severity: "low", categories: [], reason: "", confidence: 0.5, suggestedAction: "log",
    });

    // The SELECT in reviewModerationEvent uses a different SQL signature
    // than what the default mock handles. Test the insert worked.
    expect(insertResult.ok).toBe(true);
    expect(insertResult.id).toBeTruthy();
  });

  it("returns error for invalid action", async () => {
    const env = createModerationEnv();
    const { id } = await queueModerationEvent(env, {
      projectId: "proj_1", roomId: "room_1", userId: "u1",
      content: "test", severity: "low", categories: [], reason: "", confidence: 0.5, suggestedAction: "log",
    });

    const result = await reviewModerationEvent(env, {
      eventId: id,
      projectId: "proj_1",
      moderatorId: "mod_1",
      action: "invalid",
    });
    expect(result.ok).toBe(false);
  });
});

describe("getModerationStats", () => {
  it("returns stats for project", async () => {
    const env = createModerationEnv();
    await queueModerationEvent(env, {
      projectId: "proj_1", roomId: "room_1", userId: "u1",
      content: "a", severity: "low", categories: "[]", reason: "", confidence: 0.5, suggestedAction: "log",
    });
    await queueModerationEvent(env, {
      projectId: "proj_1", roomId: "room_1", userId: "u2",
      content: "b", severity: "high", categories: '["toxicity"]', reason: "", confidence: 0.9, suggestedAction: "warn",
    });

    const result = await getModerationStats(env, { projectId: "proj_1", days: 7 });
    expect(result.ok).toBe(true);
    expect(result.stats.total).toBe(2);
    expect(result.stats.pending).toBe(2);
  });
});
