import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseDigestHighlights,
  previousDigestDate,
  digestWindowBounds,
  upsertDigestPreferences,
  processUserDailyDigest,
  runDailyDigest,
} from "./daily-digest.js";

describe("parseDigestHighlights", () => {
  it("parses JSON array", () => {
    expect(parseDigestHighlights('["A done", "B shipped", "C blocked"]')).toEqual([
      "A done",
      "B shipped",
      "C blocked",
    ]);
  });

  it("parses fenced JSON", () => {
    expect(parseDigestHighlights('```json\n["One", "Two"]\n```')).toEqual(["One", "Two"]);
  });

  it("falls back to bullet lines", () => {
    expect(parseDigestHighlights("- First\n- Second")).toEqual(["First", "Second"]);
  });
});

describe("digestWindowBounds", () => {
  it("covers one UTC day", () => {
    const { startIso, endIso } = digestWindowBounds("2026-06-07");
    expect(startIso).toBe("2026-06-07T00:00:00.000Z");
    expect(endIso).toBe("2026-06-08T00:00:00.000Z");
  });
});

describe("previousDigestDate", () => {
  it("returns the day before anchor", () => {
    expect(previousDigestDate("2026-06-08")).toBe("2026-06-07");
  });
});

describe("upsertDigestPreferences", () => {
  it("rejects invalid email", async () => {
    const env = { DB: createPrefsDb() };
    const result = await upsertDigestPreferences(env, "proj_1", "user_1", {
      enabled: true,
      email: "not-an-email",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("invalid_email");
  });
});

describe("processUserDailyDigest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("skips when no messages yesterday", async () => {
    const env = createProcessEnv({ messages: [] });
    const result = await processUserDailyDigest(env, {
      projectId: "proj_1",
      userId: "user_1",
      digestDate: "2026-06-07",
      prefs: { emailEnabled: true, webPushEnabled: true, inAppEnabled: true, email: null },
    });
    expect(result.skipped).toBe(true);
  });

  it("generates highlights and records in-app delivery", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '["Shipped voice", "Fixed bug", "Plan retro"]' } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const env = createProcessEnv({
      messages: [
        {
          room_id: "room_1",
          user_id: "alice",
          content: "We shipped voice messages",
          created_at: "2026-06-07T10:00:00.000Z",
        },
      ],
    });

    const result = await processUserDailyDigest(env, {
      projectId: "proj_1",
      userId: "user_1",
      digestDate: "2026-06-07",
      prefs: {
        email: null,
        emailEnabled: false,
        webPushEnabled: false,
        inAppEnabled: true,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.highlights).toHaveLength(3);
    expect(env._inAppNotifications).toHaveLength(1);
    expect(env._deliveries).toHaveLength(1);
  });
});

describe("runDailyDigest", () => {
  it("returns skipped when disabled", async () => {
    const result = await runDailyDigest({ DAILY_DIGEST_ENABLED: "false", DB: createPrefsDb() });
    expect(result.skipped).toBe(true);
  });
});

function createPrefsDb() {
  const prefs = [];
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes("FROM user_digest_preferences")) {
                return prefs.find(
                  (p) => p.project_id === args[0] && p.user_id === args[1],
                );
              }
              return null;
            },
            async run() {
              if (sql.includes("INSERT INTO user_digest_preferences")) {
                const [
                  projectId,
                  userId,
                  enabled,
                  email,
                  emailEnabled,
                  webPushEnabled,
                  inAppEnabled,
                  updatedAt,
                ] = args;
                const idx = prefs.findIndex(
                  (p) => p.project_id === projectId && p.user_id === userId,
                );
                const row = {
                  project_id: projectId,
                  user_id: userId,
                  enabled,
                  email,
                  email_enabled: emailEnabled,
                  web_push_enabled: webPushEnabled,
                  in_app_enabled: inAppEnabled,
                  updated_at: updatedAt,
                };
                if (idx >= 0) prefs[idx] = row;
                else prefs.push(row);
              }
              return { meta: { changes: 1 } };
            },
            async all() {
              return { results: [] };
            },
          };
        },
      };
    },
  };
}

function createProcessEnv({ messages }) {
  const deliveries = [];
  const inAppNotifications = [];
  const env = {
    AI_BASE_URL: "https://llm.example.com",
    AI_API_KEY: "sk-test",
    _deliveries: deliveries,
    _inAppNotifications: inAppNotifications,
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() {
                if (sql.includes("FROM digest_deliveries")) return null;
                if (sql.includes("FROM room_members rm")) {
                  return { room_id: "room_1", name: "General" };
                }
                return null;
              },
              async all() {
                if (sql.includes("FROM room_members rm")) {
                  return { results: [{ room_id: "room_1", name: "General" }] };
                }
                if (sql.includes("FROM messages")) {
                  return { results: messages };
                }
                if (sql.includes("FROM user_digest_preferences")) {
                  return { results: [] };
                }
                return { results: [] };
              },
              async run() {
                if (sql.includes("INSERT INTO in_app_notifications")) {
                  inAppNotifications.push(args);
                }
                if (sql.includes("INSERT INTO digest_deliveries")) {
                  deliveries.push(args);
                }
                return { meta: { changes: 1 } };
              },
            };
          },
        };
      },
    },
  };
  return env;
}
